import unittest, tempfile, os, importlib.util, uuid
from unittest.mock import patch
from pathlib import Path
os.environ.update(HDQAZ_API_BASE_URL='https://api.test',CONTENT_CLEANUP_TOKEN='test-only',R2_BUCKET='test-only')
spec=importlib.util.spec_from_file_location('executor',Path(__file__).with_name('executor.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Client:
 def __init__(self,fail=False):self.keys={'candidates/job-1/master.m3u8','candidates/job-1/a.ts','candidates/other-1/master.m3u8'};self.fail=fail
 def get_paginator(self,*a):return self
 def paginate(self,**kw):yield {'Contents':[{'Key':k} for k in self.keys if k.startswith(kw['Prefix'])]}
 def delete_objects(self,**kw):
  if self.fail:return {'Errors':[{'Code':'Denied'}]}
  for k in kw['Delete']['Objects']:self.keys.discard(k['Key'])
  return {}
 def list_objects_v2(self,**kw):return {'KeyCount':int(any(k.startswith(kw['Prefix']) for k in self.keys))}
class Tests(unittest.TestCase):
 def test_exact_prefix_retry(self):
  c=Client();e=m.Executor(c);e.r2('candidates/job-1/');e.r2('candidates/job-1/');self.assertEqual(c.keys,{'candidates/other-1/master.m3u8'})
 def test_partial_failure_reported_shared_never_removed(self):
  e=m.Executor(Client(True));e.busy=lambda ids,refs=None:False
  a=[{'id':'one','kind':'r2','path':'candidates/job-1/'},{'id':'two','kind':'r2','path':'candidates/other-1/','shared':True}];r=e.execute({'workflow_ids':[],'assets':a});self.assertEqual([x['state'] for x in r],['error','shared']);self.assertEqual(len(e.client.keys),3)
 def test_unsafe_local_path(self):
  e=m.Executor(Client());self.assertRaises(ValueError,e.local,'job/../../real')
 def test_busy_ingestion_does_not_delete(self):
  e=m.Executor(Client());e.busy=lambda ids,refs=None:True;r=e.execute({'workflow_ids':['id'],'assets':[{'id':'r','kind':'r2','path':'candidates/job-1/'}]});self.assertEqual(r[0]['error'],'local_busy');self.assertEqual(len(e.client.keys),3)
 def test_workflow_cancellation_and_exact_interrupted_source_cleanup(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);sources=root/'sources';sources.mkdir();(sources/'inbox').mkdir()
   workflow='33333333-3333-4333-8333-333333333333';ref=str(uuid.uuid5(uuid.NAMESPACE_URL,f'hdqaz-telegram:123:{workflow}:10'))
   file=sources/'inbox'/(ref+'.media');file.write_bytes(b'owned');os.utime(file,(0,0))
   real_path=Path
   def paths(value):return sources if value=='/sources' else sources/'inbox' if value=='/sources/inbox' else real_path(value)
   e=m.Executor(Client());e.states=lambda:[{'id':workflow,'source_ref':ref,'actor':123,'update':10,'mode':'interrupted'}]
   with patch.object(m,'Path',side_effect=paths):
    e.cancel(workflow);self.assertTrue((sources/('.cleanup-'+workflow)).exists())
    e.local('workflow/'+workflow,{'source_refs':[],'protected_source_refs':[ref]});self.assertTrue(file.exists())
    self.assertRaises(m.UnverifiedSource,e.local,'workflow/'+workflow,{'source_refs':[],'protected_source_refs':[]})
    e.local('workflow/'+workflow,{'source_refs':[ref],'protected_source_refs':[]});self.assertFalse(file.exists())
if __name__=='__main__':unittest.main()
