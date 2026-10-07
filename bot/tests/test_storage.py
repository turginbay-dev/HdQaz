import json,os,tempfile,time,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from hdqaz_bot.storage import StorageAdmin,atomic
class Telegram:
 def __init__(self):self.sent=[]
 def send(self,actor,text):self.sent.append((actor,text))
class Tests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();self.p=Path(self.t.name);self.bot=SimpleNamespace(c=SimpleNamespace(admins={123}),tg=Telegram());self.env=patch.dict(os.environ,{'BOT_CONTROL_ROOT':str(self.p)});self.env.start();self.s=StorageAdmin(self.bot)
  atomic(self.p/'storage.json',{'timestamp':time.time(),'enabled':True,'disk':{'total':40*1024**3,'used':16*1024**3,'free':24*1024**3,'percent':40},'claiming_paused':False,'active_jobs':1,'stale_jobs':0})
 def tearDown(self):self.env.stop();self.t.cleanup()
 def test_disk_usage(self):
  self.assertTrue(self.s.command(123,'/disk'));text=self.bot.tg.sent[-1][1];self.assertIn('40.0 GB',text);self.assertIn('16.0 GB',text);self.assertIn('40%',text)
 def test_cleanup_requests_scan_only(self):
  self.s.command(123,'/cleanup');self.assertTrue((self.p/'cleanup-request').is_file())
 def test_stale_report_not_online(self):
  atomic(self.p/'storage.json',{'timestamp':0});self.s.command(123,'/status');self.assertIn('жаңа күй алынбады',self.bot.tg.sent[-1][1])
 def test_event_is_delivered_once(self):
  events=self.p/'events';events.mkdir();name='a'*64;atomic(events/name,{'kind':'cleanup','reason':'failed','title':'Test','job':'fixture','bytes':123})
  self.s.notify();self.s.notify();self.assertEqual(len(self.bot.tg.sent),1);self.assertFalse((events/name).exists())
 def test_non_command_untouched(self):self.assertFalse(self.s.command(123,'/start'))
if __name__=='__main__':unittest.main()
