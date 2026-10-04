import tempfile,unittest,uuid
from pathlib import Path
from hdqaz_bot.ingestion import stage_local
from hdqaz_bot.core import SafeError

class IngestionTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.root=Path(self.tmp.name);self.inbox=self.root/'inbox';self.inbox.mkdir()
  self.source=self.root/'movie';self.source.write_bytes(b'\x00\x00\x00\x18ftypisom'+b'x'*2097152)
  self.ref=str(uuid.uuid4())
 def stage(self,**kw):
  return stage_local(self.root,self.source,self.inbox,self.ref,self.source.stat().st_size,4*1024**2,reserve=0,**kw)
 def test_atomic_readonly_copy(self):
  p=self.stage();self.assertEqual(p.read_bytes(),self.source.read_bytes());self.assertEqual(p.stat().st_mode&0o222,0)
  self.assertEqual(list(self.inbox.glob('*.partial')),[])
 def test_does_not_overwrite(self):
  p=self.stage();before=p.stat().st_ino
  self.assertRaises(SafeError,self.stage);self.assertEqual(p.stat().st_ino,before)
 def test_interruption_cleans_partial(self):
  def fail():raise SafeError('lease_lost')
  self.assertRaises(SafeError,self.stage,check=fail);self.assertEqual(list(self.inbox.iterdir()),[])
 def test_rejects_symlink(self):
  real=self.source;link=self.root/'link';link.symlink_to(real);self.source=link
  self.assertRaises(SafeError,self.stage)
 def test_rejects_parent_symlink(self):
  d=self.root/'dir';d.mkdir();(d/'movie').write_bytes(self.source.read_bytes())
  link=self.root/'linked';link.symlink_to(d,target_is_directory=True);self.source=link/'movie'
  self.assertRaises(SafeError,self.stage)
 def test_rejects_nonvideo(self):
  self.source.write_bytes(b'<html>not video</html>');self.assertRaises(SafeError,self.stage)
 def test_rejects_size_mismatch(self):
  self.assertRaises(SafeError,stage_local,self.root,self.source,self.inbox,self.ref,1,10,reserve=0)
 def test_recover_interrupted_partial(self):
  partial=self.inbox/('.tg-'+self.ref+'.partial');partial.write_bytes(b'incomplete')
  target=self.stage();self.assertTrue(target.exists());self.assertFalse(partial.exists())
 def test_partial_symlink_rejected(self):
  partial=self.inbox/('.tg-'+self.ref+'.partial');partial.symlink_to(self.source)
  self.assertRaises(SafeError,self.stage);self.assertTrue(self.source.exists())
 def test_rejects_outside_root(self):
  self.assertRaises(SafeError,stage_local,self.inbox,self.source,self.inbox,self.ref,self.source.stat().st_size,4*1024**2,reserve=0)
if __name__=='__main__':unittest.main()
