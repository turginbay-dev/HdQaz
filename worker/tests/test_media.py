import json
import os
import platform
import shutil
import subprocess
import tempfile
import threading
import time
import unittest
from pathlib import Path
from dataclasses import replace
from unittest.mock import patch
from hdqaz_worker.core import Failure, LeaseLost
from hdqaz_worker.media import Runner,encode
from hdqaz_worker.storage import verify_local,package_files,LocalStorage
from hdqaz_worker.main import Worker
from test_worker import config,JOB,FakeApi

@unittest.skipUnless(platform.system()=='Linux' and shutil.which('ffmpeg'),'Media tests run on Linux server only; never Mac')
class MediaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();cls.root=Path(cls.temp.name);cls.c=config(cls.root)
        cls.c.workspace.mkdir();cls.c.sources.mkdir()
        def synthetic(path,size,duration):
            subprocess.run(['ffmpeg','-nostdin','-v','error','-f','lavfi','-i',f'testsrc2=size={size}:rate=25',
                '-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t',str(duration),'-c:v','libx264',
                '-threads','1','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',str(path)],check=True)
        synthetic(cls.c.intro,'320x180',0.8)
        cls.video=cls.root/'video.mp4';synthetic(cls.video,'1280x720',2)
        cls.fullhd=cls.root/'fullhd.mp4';synthetic(cls.fullhd,'1920x1080',2)
        subprocess.run(['ffmpeg','-nostdin','-v','error','-f','lavfi','-i','color=c=white:s=96x32','-frames:v','1','-threads','1',str(cls.c.watermark)],check=True)
    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()
    def test_probe_and_full_decode(self):
        runner=Runner(self.c);meta=runner.probe(self.video);self.assertEqual(meta.height,720);runner.decode(self.video,meta.duration)
    def test_corrupt_source(self):
        path=self.root/'broken.mp4';path.write_bytes(b'bad media')
        with self.assertRaises(Failure):Runner(self.c).probe(path)
    def test_truncated_source(self):
        path=self.root/'truncated.mp4';data=self.video.read_bytes();path.write_bytes(data[:len(data)//2])
        with self.assertRaises(Failure):
            runner=Runner(self.c);meta=runner.probe(path);runner.decode(path,meta.duration)
    def test_branding_hls_720_no_fake_1080(self):
        runner=Runner(self.c);out=self.root/'hls720'
        variants,duration=encode(self.c,runner,self.video,runner.probe(self.video),runner.probe(self.c.intro),out,lambda _:None)
        self.assertEqual(len(variants),1);self.assertEqual(variants[0].height,720)
        verify_local(out,duration,runner,variants)
        self.assertIn('RESOLUTION=1280x720',(out/'master.m3u8').read_text())
    def test_1080_and_720(self):
        runner=Runner(self.c);out=self.root/'hls1080'
        variants,duration=encode(self.c,runner,self.fullhd,runner.probe(self.fullhd),runner.probe(self.c.intro),out,lambda _:None)
        self.assertEqual([r.height for r in variants],[1080,720]);verify_local(out,duration,runner,variants)
        segment=next((out/'0').glob('*.ts'));segment.unlink()
        with self.assertRaises(Failure):package_files(out,duration)
    def test_processing_stops_on_lease_loss(self):
        cancel=threading.Event()
        def check():
            if cancel.is_set():raise LeaseLost()
        timer=threading.Timer(0.4,cancel.set);timer.start();started=time.monotonic()
        try:
            with self.assertRaises(LeaseLost):
                Runner(self.c,check).run(['ffmpeg','-nostdin','-v','error','-re','-f','lavfi','-i','testsrc2=size=64x64:rate=1','-t','120','-f','null','-'])
            self.assertLess(time.monotonic()-started,5)
        finally:timer.cancel()
    def test_source_cannot_be_external_playlist(self):
        path=self.root/'unsafe.media';path.write_text('#EXTM3U\n#EXTINF:10,\nhttp://127.0.0.1/secret\n')
        with self.assertRaises(Failure):Runner(self.c).probe(path)
    def test_missing_branding_fails(self):
        runner=Runner(replace(self.c,intro=self.root/'missing.mp4'))
        with self.assertRaises(Failure):runner.probe(self.root/'missing.mp4')
    def test_local_end_to_end_ready_and_cleanup(self):
        api=FakeApi();c=replace(self.c,max_source=10*1024**2)
        shutil.copyfile(self.video,c.sources/(JOB['id']+'.media'))
        worker=Worker(c,api=api)
        try:self.assertTrue(worker.process(JOB,allow_local_complete=True))
        finally:worker.close()
        complete=[body for path,body in api.calls if path.endswith('/complete')]
        self.assertEqual(len(complete),1);self.assertEqual(complete[0]['output_metadata']['height'],720)
        self.assertTrue(complete[0]['output_manifest_url'].endswith('/master.m3u8'))
        self.assertEqual(list(c.workspace.glob('*/source.media')),[])
        self.assertEqual(len(list(c.storage.glob('*/master.m3u8'))),1)
    def test_upload_failure_calls_fail(self):
        api=FakeApi();c=replace(self.c,max_source=10*1024**2)
        shutil.copyfile(self.video,c.sources/(JOB['id']+'.media'))
        worker=Worker(c,api=api)
        try:
            with patch.object(worker.storage,'upload',side_effect=Failure('upload_failed')):
                self.assertFalse(worker.process(JOB,allow_local_complete=True))
        finally:worker.close()
        self.assertFalse(any(p.endswith('/complete') for p,_ in api.calls))
        self.assertEqual([b['error_code'] for p,b in api.calls if p.endswith('/fail')],['upload_failed'])

if __name__=='__main__':unittest.main()
