import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from dataclasses import replace
from hdqaz_worker.core import Config,ApiFailure,Failure,Lease,LeaseLost,backoff,log
from hdqaz_worker.workspace import Workspaces,MountedSource,MARKER
from hdqaz_worker.media import Media,renditions,Runner
from hdqaz_worker.storage import package_files,LocalStorage
from hdqaz_worker.main import Worker

JOB={'id':'11111111-1111-4111-8111-111111111111','lease_token':'22222222-2222-4222-8222-222222222222','attempt_count':1,'status':'downloading'}
def config(root):
    return Config('https://api.example.test','x'*32,'test-worker',root/'work',root/'sources',root/'intro.mp4',root/'logo.png',root/'storage','https://cdn.example.test',min_free=1024,max_source=1024**2,threads=1,preset='ultrafast')

class FakeApi:
    def __init__(self):self.calls=[];self.reject=False;self.terminal_failure=0
    def call(self,path,body):
        self.calls.append((path,body))
        if self.reject:raise ApiFailure(409)
        if path.endswith('/complete'):
            if self.terminal_failure:
                self.terminal_failure-=1;raise ApiFailure(503)
            return {'id':JOB['id'],'status':'ready'}
        return {'id':JOB['id'],'status':'failed' if path.endswith('/fail') else body.get('stage'),'progress_percent':body.get('progress_percent')}
    def claim(self):return dict(JOB)

class LogicTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.c=config(self.root)
        self.c.workspace.mkdir();self.c.sources.mkdir()
    def tearDown(self):self.temp.cleanup()
    def test_empty_backoff_bounded(self):
        values=[backoff(i,rng=lambda:1) for i in range(30)]
        self.assertEqual(values[:5],[5,10,20,40,60]);self.assertLessEqual(max(values),60)
    def test_empty_queue_loop_backs_off(self):
        class Stop:
            def __init__(self):self.delays=[]
            def is_set(self):return len(self.delays)>=3
            def wait(self,seconds):self.delays.append(seconds);return self.is_set()
        class Storage:
            remotely_verified=True
            def cleanup_partials(self):pass
        api=FakeApi();api.claim=lambda:None;stop=Stop();worker=Worker(self.c,api=api,storage=Storage(),stop=stop)
        try:worker.run()
        finally:worker.close()
        self.assertEqual(len(stop.delays),3);self.assertGreater(stop.delays[1],stop.delays[0])
    def test_source_size_and_disk_limits(self):
        path=self.c.sources/(JOB['id']+'.media');path.write_bytes(b'x'*128)
        with self.assertRaises(Failure):MountedSource(replace(self.c,max_source=64)).acquire(JOB,self.c.workspace/'input',lambda:None,lambda _:None)
        with patch('hdqaz_worker.workspace.shutil.disk_usage',return_value=SimpleNamespace(free=0)):
            with self.assertRaises(Failure):MountedSource(self.c).acquire(JOB,self.c.workspace/'input',lambda:None,lambda _:None)
    def test_claim_heartbeat_and_monotone_progress(self):
        api=FakeApi();lease=Lease(api,JOB,threading.Event(),0.01);lease.start()
        lease.update('processing',20);lease.set_progress(10);lease.update()
        self.assertEqual(api.calls[-1][1]['progress_percent'],20)
        self.assertTrue(lease.thread.is_alive());lease.close()
    def test_periodic_heartbeat_runs_during_work(self):
        api=FakeApi();lease=Lease(api,JOB,threading.Event(),0.01);lease.start()
        try:
            time.sleep(0.055)
            self.assertGreaterEqual(len(api.calls),3)
        finally:lease.close()
    def test_lease_loss_cancels_and_cannot_complete(self):
        api=FakeApi();lease=Lease(api,JOB,threading.Event());lease.start();api.reject=True
        with self.assertRaises(LeaseLost):lease.update()
        with self.assertRaises(LeaseLost):lease.terminal('complete',{})
        self.assertFalse(any(p.endswith('/complete') for p,_ in api.calls));lease.close()
    def test_api_outage_fences_work(self):
        api=FakeApi();lease=Lease(api,JOB,threading.Event())
        with patch.object(api,'call',side_effect=ApiFailure(503)):
            with self.assertRaises(LeaseLost):lease.start()
        self.assertTrue(lease.cancel.is_set())
    def test_malformed_heartbeat_response_fences_work(self):
        api=FakeApi();api.call=lambda *_:None
        with self.assertRaises(LeaseLost):Lease(api,JOB,threading.Event()).start()
    def test_local_deadline_fences_stalled_heartbeat(self):
        lease=Lease(FakeApi(),JOB,threading.Event());lease.deadline=0
        with self.assertRaises(LeaseLost):lease.check()
    def test_exact_terminal_replay(self):
        api=FakeApi();api.terminal_failure=1;lease=Lease(api,JOB,threading.Event());lease.start()
        lease.update('processing',10);lease.update('uploading',80)
        with patch.object(lease.stop,'wait',return_value=False):lease.terminal('complete',{'output_manifest_url':'https://cdn.example.test/a.m3u8'})
        bodies=[b for p,b in api.calls if p.endswith('/complete')]
        self.assertEqual(len(bodies),2);self.assertEqual(bodies[0],bodies[1]);lease.close()
    def test_shutdown_fences_work(self):
        stop=threading.Event();lease=Lease(FakeApi(),JOB,stop);stop.set()
        with self.assertRaises(LeaseLost):lease.check()
    def test_no_upscale(self):
        self.assertEqual([(r.width,r.height) for r in renditions(Media(1280,720,10,25))],[(1280,720)])
        self.assertEqual([(r.width,r.height) for r in renditions(Media(1920,1080,10,25))],[(1920,1080),(1280,720)])
        self.assertEqual([(r.width,r.height) for r in renditions(Media(640,360,10,25))],[(640,360)])
        self.assertEqual([(r.width,r.height) for r in renditions(Media(3840,2160,10,25))],[(1920,1080),(1280,720)])
    def test_source_missing_and_traversal(self):
        provider=MountedSource(self.c)
        with self.assertRaises(Failure):provider.acquire(JOB,self.c.workspace/'source',lambda:None,lambda _:None)
        with self.assertRaises(Failure):provider.acquire({**JOB,'id':'../../etc/passwd'},self.c.workspace/'source',lambda:None,lambda _:None)
    def test_source_streaming_limit_and_symlink(self):
        p=self.c.sources/(JOB['id']+'.media');p.write_bytes(b'x'*128)
        provider=MountedSource(self.c)
        target=self.c.workspace/'source';provider.acquire(JOB,target,lambda:None,lambda _:None)
        self.assertEqual(target.read_bytes(),b'x'*128)
        target.unlink();p.unlink();p.symlink_to('/etc/passwd')
        with self.assertRaises(Failure):provider.acquire(JOB,target,lambda:None,lambda _:None)
    def test_immutable_handoff_avoids_copy_and_preserves_source(self):
        p=self.c.sources/(JOB['id']+'.media');p.write_bytes(b'x'*128);p.chmod(0o444)
        destination=self.c.workspace/'source';progress=[]
        self.assertEqual(MountedSource(self.c).acquire(JOB,destination,lambda:None,progress.append),p)
        self.assertFalse(destination.exists());self.assertTrue(p.exists());self.assertEqual(progress,[1])
        with self.assertRaises(LeaseLost):MountedSource(self.c).acquire(JOB,destination,lambda:(_ for _ in ()).throw(LeaseLost()),lambda _:None)
    def test_cleanup_boundary_and_lock(self):
        ws=Workspaces(replace(self.c,retention_seconds=0));p=ws.create(JOB)
        foreign=self.root/'foreign';foreign.mkdir();(foreign/'keep').write_text('keep')
        (p/'escape').symlink_to(foreign,target_is_directory=True)
        with self.assertRaises(Failure):ws.remove(foreign)
        with self.assertRaises(Failure):Workspaces(self.c)
        ws.remove(p);self.assertTrue((foreign/'keep').exists());ws.close()
    def test_retention_budget(self):
        ws=Workspaces(replace(self.c,retention_bytes=10));p=ws.create(JOB);(p/'source').write_bytes(b'a'*100)
        ws.cleanup();self.assertFalse(p.exists());ws.close()
    def test_logs_drop_secrets(self):
        out=io.StringIO()
        with contextlib.redirect_stdout(out):log('test',token='SECRET',url='https://secret',headers='SECRET',code='invalid_media')
        self.assertNotIn('SECRET',out.getvalue());self.assertNotIn('https',out.getvalue())
    def test_invalid_manifest(self):
        root=self.root/'hls';root.mkdir();(root/'master.m3u8').write_text('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\n../../secret\n')
        with self.assertRaises(Failure):package_files(root,1)
    def test_local_adapter_cannot_poll_production(self):
        worker=Worker(self.c,api=FakeApi())
        with self.assertRaises(Failure):worker.run()
        worker.close()
    def test_upload_missing_file_never_ready(self):
        storage=LocalStorage(self.c)
        with self.assertRaises((Failure,OSError)):storage.upload(self.root,['missing.ts'],JOB,lambda:None,lambda _:None)
    def test_config_rejects_http_and_shared_roots(self):
        env={'HDQAZ_API_BASE_URL':'http://localhost','AUTOMATION_WORKER_ID':'one','AUTOMATION_WORKER_TOKEN':'x'*32,
            'WORKER_WORKSPACE':str(self.c.workspace),'WORKER_SOURCE_ROOT':str(self.c.sources),
            'WORKER_INTRO_PATH':str(self.c.intro),'WORKER_WATERMARK_PATH':str(self.c.watermark),
            'WORKER_STORAGE_ROOT':str(self.c.storage),'WORKER_OUTPUT_ORIGIN':'https://cdn.example.test'}
        with patch.dict(os.environ,env,clear=True):
            with self.assertRaises(Failure):Config.from_env()
        env['HDQAZ_API_BASE_URL']='https://api.example.test';env['WORKER_STORAGE_ROOT']=env['WORKER_WORKSPACE']
        with patch.dict(os.environ,env,clear=True):
            with self.assertRaises(Failure):Config.from_env()

if __name__=='__main__':unittest.main()
