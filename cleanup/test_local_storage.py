import contextlib,fcntl,io,json,os,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
from local_storage import *
ID='11111111-1111-4111-8111-111111111111'
REF='22222222-2222-4222-8222-222222222222'
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name).resolve();self.work=self.root/'work';self.sources=self.root/'sources';self.state=self.root/'control'
  self.work.mkdir();self.sources.mkdir();(self.sources/'inbox').mkdir();self.now=time.time();self.job={'id':ID,'status':'ready','attempt_count':1,'progress_percent':100};self.calls=[];self.flows=[];self.states=[]
  self.m=Maintenance(self.work,self.sources,self.state,self.call,lambda:self.states,settings({'CLEANUP_ENABLED':'true'}),lambda:self.now)
  (self.state/'source-lock').touch()
 def tearDown(self):self.tmp.cleanup()
 def call(self,b):
  self.calls.append(b)
  if b['action']=='local_stale':self.job['status']='failed';return {'failed':True}
  return {'jobs':[self.job] if self.job else [],'sources':[{'id':r,'flows':self.flows} for r in b['sources']]}
 def folder(self):
  p=self.work/(ID+'-1-0123456789abcdef');p.mkdir();(p/MARKER).write_text('v2');(p/'movie').write_bytes(b'x'*4096);return p
 def scan(self):
  with contextlib.redirect_stdout(io.StringIO()):return self.m.scan()
 def test_ready_removed(self):
  p=self.folder();self.scan();self.assertFalse(p.exists())
 def test_failed_removed_and_notification(self):
  p=self.folder();self.job['status']='failed';self.scan();self.assertFalse(p.exists());self.assertEqual(len(list((self.state/'events').iterdir())),1)
 def test_cancelled_removed(self):
  p=self.folder();self.job.update(status='failed',admin_cancelled_at='date');self.scan();self.assertFalse(p.exists())
 def test_healthy_active_retained(self):
  p=self.folder();self.job['status']='processing';self.now+=999999;self.scan();self.assertTrue(p.exists())
 def stale(self):
  self.job.update(status='processing',heartbeat_at='2020-01-01T00:00:00Z',lease_expires_at='2020-01-01T00:02:00Z',progress_percent=30)
 def test_slow_progress_retained(self):
  p=self.folder();self.stale();self.scan();self.now+=1900;self.job['progress_percent']=31;self.scan();self.assertTrue(p.exists())
 def test_file_growing_retained(self):
  p=self.folder();self.stale();self.scan();self.now+=1900;(p/'movie').write_bytes(b'x'*8192);self.scan();self.assertTrue(p.exists())
 def test_mtime_change_retained(self):
  p=self.folder();self.stale();self.scan();self.now+=1900;os.utime(p/'movie',(self.now,self.now));self.scan();self.assertTrue(p.exists())
 def test_stale_confirmed_and_removed(self):
  p=self.folder();self.stale();self.scan();self.assertTrue(p.exists());self.now+=1900;self.scan();self.assertFalse(p.exists());self.assertTrue(any(c['action']=='local_stale' for c in self.calls))
 def test_process_lock_retains(self):
  p=self.folder();self.stale();self.scan();self.now+=1900
  with open(p/MARKER) as f:
   fcntl.flock(f,fcntl.LOCK_EX);self.scan();self.assertTrue(p.exists())
 def test_orphan_requires_old_files(self):
  p=self.folder();self.job=None;self.scan();self.assertTrue(p.exists());self.now+=3700;self.scan();self.assertFalse(p.exists())
 def test_outside_root_and_root_refused(self):
  p=self.folder()
  for root,path in [(self.work,self.root),(self.work,Path('/')),(self.work,self.work),(Path('/'),p),(Path(''),p)]:
   with self.assertRaises(Unsafe):remove_directory(root,path)
  self.assertTrue(p.exists())
 def test_symlink_parent_refused(self):
  p=self.folder();link=self.root/'link';link.symlink_to(self.work)
  with self.assertRaises(Unsafe):remove_directory(link,link/p.name)
 def test_shared_source_retained(self):
  p=self.sources/'inbox'/(REF+'.media');p.write_bytes(b'x');self.flows=[{'job_id':ID,'state':'submitted'}];self.job['status']='processing';self.scan();self.assertTrue(p.exists())
 def test_source_busy_and_terminal(self):
  p=self.sources/'inbox'/(REF+'.media');p.write_bytes(b'x');self.flows=[{'job_id':ID,'state':'submitted'}]
  with p.open('rb') as f:
   fcntl.flock(f,fcntl.LOCK_SH);self.scan();self.assertTrue(p.exists())
  self.scan();self.assertFalse(p.exists())
 def test_ingestion_protected(self):
  p=self.sources/'inbox'/(REF+'.media');p.write_bytes(b'x');self.now+=3700;self.states=[{'mode':'ingest','source_ref':REF}];self.scan();self.assertTrue(p.exists())
 def test_database_unavailable_no_delete(self):
  p=self.folder();self.m.call=lambda _:(_ for _ in ()).throw(OSError())
  with contextlib.redirect_stdout(io.StringIO()):r=self.m.tick(force=True)
  self.assertTrue(p.exists());self.assertTrue(r['claiming_paused'])
 def test_80_triggers_and_90_pauses(self):
  for percent in (81,91):
   with patch('local_storage.usage',return_value={'total':100,'used':percent,'free':100-percent,'percent':percent}),patch.object(self.m,'scan',return_value={'active_jobs':0,'stale_jobs':0}) as scan:
    r=self.m.tick();self.assertTrue(scan.called);self.assertEqual(r['claiming_paused'],percent==91)
 def test_usage_real_filesystem(self):
  d=usage(self.work);self.assertEqual(d['total'],shutil.disk_usage(self.work).total);self.assertEqual(d['used']+d['free'],d['total'])
 def test_disabled_no_deletion(self):
  p=self.folder();self.m.cfg['enabled']=False;self.m.tick(force=True);self.assertTrue(p.exists())
 def test_no_cloud_clients(self):
  import local_storage
  text=Path(local_storage.__file__).read_text();self.assertNotIn('boto3',text);self.assertNotIn('delete_objects',text)
if __name__=='__main__':unittest.main()
