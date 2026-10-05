import unittest, tempfile, os, importlib.util
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
if __name__=='__main__':unittest.main()
