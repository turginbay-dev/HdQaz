import tempfile,unittest,threading,time,os,json
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from hdqaz_worker.main import Worker
from hdqaz_worker.core import Failure,LeaseLost
from hdqaz_worker.local_state import can_claim
from hdqaz_worker.workspace import MountedSource
from test_worker import config,JOB,FakeApi
class Tests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();self.root=Path(self.t.name);self.c=config(self.root);self.c.workspace.mkdir();self.c.sources.mkdir()
 def tearDown(self):self.t.cleanup()
 def run_worker(self,failure=None):
  class Source:
   def acquire(self,job,path,*args):path.write_bytes(b'x'*1024);return path
  class Runner:
   def __init__(self,*args):pass
   def probe(self,*args,**kwargs):return SimpleNamespace(duration=2)
   def decode(self,*args):pass
  class Storage:
   remotely_verified=True
   def upload(self,*args):
    if failure:raise failure
    return 'https://cdn.example.test/fixture/master.m3u8'
  def encode(*args):
   p=args[5];p.mkdir();(p/'master.m3u8').write_text('fixture');return [SimpleNamespace(width=320,height=180)],4
  api=FakeApi();worker=Worker(self.c,api=api,source=Source(),storage=Storage())
  with patch('hdqaz_worker.main.Runner',Runner),patch('hdqaz_worker.main.encode',encode),patch('hdqaz_worker.main.verify_local',return_value=['master.m3u8']):result=worker.process(JOB)
  worker.close();return result,api
 def test_ready_cleanup_after_confirm(self):
  result,api=self.run_worker();self.assertTrue(result);self.assertFalse(list(self.c.workspace.glob('*/source.media')));self.assertTrue(any(p.endswith('/complete') for p,_ in api.calls))
 def test_upload_failure_saved_and_cleaned(self):
  result,api=self.run_worker(Failure('upload_failed'));self.assertFalse(result);self.assertFalse(list(self.c.workspace.glob('*/source.media')));self.assertTrue(any(p.endswith('/fail') and b['error_code']=='upload_failed' for p,b in api.calls))
 def test_unconfirmed_lease_retained_for_authoritative_scanner(self):
  result,api=self.run_worker(LeaseLost());self.assertFalse(result);self.assertTrue(list(self.c.workspace.glob('*/source.media')))
 def test_missing_source_rehydration_request(self):
  control=self.root/'control';control.mkdir();provider=MountedSource(self.c);target=self.c.sources/(JOB['id']+'.media')
  def hydrate():
   for _ in range(50):
    if (control/'source-request.json').exists():target.write_bytes(b'new-source');target.chmod(0o444);return
    time.sleep(.02)
  thread=threading.Thread(target=hydrate);thread.start()
  with patch.dict(os.environ,{'WORKER_CONTROL_ROOT':str(control)}):
   try:self.assertEqual(provider.acquire(JOB,self.c.workspace/'source',lambda:None,lambda _:None),target)
   finally:provider.close();thread.join()
  self.assertEqual(json.loads((control/'source-request.json').read_text())['id'],JOB['id'])
 def test_pressure_blocks_claim_and_fresh_report_resumes(self):
  control=self.root/'control';control.mkdir()
  with patch.dict(os.environ,{'WORKER_CONTROL_ROOT':str(control)}):
   self.assertFalse(can_claim(self.c.workspace))
   (control/'storage.json').write_text(json.dumps({'timestamp':time.time(),'claiming_paused':True}));self.assertFalse(can_claim(self.c.workspace))
   (control/'storage.json').write_text(json.dumps({'timestamp':time.time(),'claiming_paused':False}))
   with patch('hdqaz_worker.local_state.shutil.disk_usage',return_value=SimpleNamespace(total=100,free=30)):self.assertTrue(can_claim(self.c.workspace))
   with patch('hdqaz_worker.local_state.shutil.disk_usage',return_value=SimpleNamespace(total=100,free=5)):self.assertFalse(can_claim(self.c.workspace))
if __name__=='__main__':unittest.main()
