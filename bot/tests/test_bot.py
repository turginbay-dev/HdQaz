import os
import tempfile
import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace
from hdqaz_bot.core import authorized,callback,button,request_key,Sources,SafeError
from hdqaz_bot.main import Bot
ID='11111111-1111-4111-8111-111111111111'
def update(actor=123,text='/start',chat_type='private'):
 return {'update_id':10,'message':{'from':{'id':actor},'chat':{'id':actor,'type':chat_type},'text':text}}
class Telegram:
 def __init__(self):self.calls=[]
 def send(self,*args):self.calls.append(('send',args));return {'message_id':1}
 def call(self,*args,**kw):self.calls.append(args);return {'message_id':1}
class API:
 def __init__(self,w=None):self.calls=[];self.w=w
 def call(self,action,*args,**kw):
  self.calls.append((action,args,kw))
  if action=='queue':return [self.w] if self.w else []
  if action=='get':return self.w
  return self.w
class Tests(unittest.TestCase):
 def config(self):return SimpleNamespace(admins={123})
 def test_default_deny_private_numeric_only(self):
  self.assertEqual(authorized(update(),{123}),123)
  for u in [update(456),update('123'),update(chat_type='group'),{'message':{'from':{'username':'123'}}}]:self.assertIsNone(authorized(u,{123}))
 def test_unauthorized_receives_no_admin_information(self):
  tg=Telegram();api=API();Bot(self.config(),api,tg,object()).handle(update(456));self.assertEqual(tg.calls,[]);self.assertEqual(api.calls,[])
 def test_authorized_menu(self):
  tg=Telegram();Bot(self.config(),API(),tg,object()).handle(update());self.assertIn('Private Admin',tg.calls[0][1][1])
 def test_callback_validation_revision_and_size(self):
  w={'id':ID,'revision':12};v=button(w,'publish','Publish')['callback_data'];self.assertLessEqual(len(v),64);self.assertEqual(callback(v),(ID,12,'publish'))
  for value in ['https://evil','x'*65,'../../etc/passwd']:self.assertRaises(SafeError,callback,value)
 def test_stale_callback_cannot_mutate(self):
  tg=Telegram();api=API({'id':ID,'revision':2});b=Bot(self.config(),api,tg,object());u={'update_id':2,'callback_query':{'id':'x','from':{'id':123},'message':{'chat':{'id':123,'type':'private'}},'data':button({'id':ID,'revision':1},'publish','x')['callback_data']}}
  self.assertRaises(SafeError,b.handle,u);self.assertEqual([a[0] for a in api.calls],['get'])
 def test_request_identity_survives_process_restart(self):self.assertEqual(request_key(123,10,'publish'),request_key(123,10,'publish'));self.assertNotEqual(request_key(123,10,'publish'),request_key(456,10,'publish'))
 def test_ready_is_review_only(self):
  tg=Telegram();api=API();b=Bot(self.config(),api,tg,object());w={'id':ID,'revision':2,'kind':'movie','state':'submitted','metadata':{'title':'Test'},'job':{'status':'ready','progress_percent':100,'attempt_count':1,'max_attempts':3,'output_manifest_url':'https://cdn.hdqaz.online/candidates/test/master.m3u8'}};b.show(123,w);self.assertEqual(api.calls,[]);self.assertIn('publish',str(tg.calls));self.assertIn('100%',str(tg.calls))
 def test_readonly_source_handoff_idempotent_no_copy(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'inbox').mkdir();ref=str(uuid.uuid4());p=root/'inbox'/(ref+'.media');p.write_bytes(b'test'*1000);p.chmod(0o444)
   s=Sources(SimpleNamespace(root=root,max_source=10000));s.stage(ref,ID);s.stage(ref,ID);self.assertEqual(p.stat().st_ino,(root/(ID+'.media')).stat().st_ino)
 def test_sources_reject_symlink_writable_oversized_and_traversal(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'inbox').mkdir();ref=str(uuid.uuid4());p=root/'inbox'/(ref+'.media');p.write_bytes(b'x'*100);s=Sources(SimpleNamespace(root=root,max_source=50));self.assertRaises(SafeError,s.source,ref);p.chmod(0o444);self.assertRaises(SafeError,s.source,ref);p.unlink();p.symlink_to('/etc/passwd');self.assertRaises(SafeError,s.source,ref);self.assertRaises(SafeError,s.source,'../../secret')
 def test_channel_posts_only_claimed_publication_and_no_retry_on_uncertainty(self):
  class PostAPI(API):
   def call(self,action,*args,**kw):
    self.calls.append((action,args,kw))
    if action=='post_claim':return {'id':ID,'status':'sending','channel_id':'-100123456','title':'Test','year':2026,'watch_url':'https://hdqaz.online/test','poster_url':''}
  class Timeout(Telegram):
   def call(self,*a,**kw):self.calls.append(a);raise SafeError()
  api=PostAPI();tg=Timeout();Bot(self.config(),api,tg,object()).post();self.assertEqual(len(tg.calls),1);self.assertEqual(api.calls[-1][2]['data']['status'],'uncertain')
 def test_no_outbox_no_channel_message(self):
  api=API();tg=Telegram();Bot(self.config(),api,tg,object()).post();self.assertEqual(tg.calls,[])
 def test_lost_bot_lease_fences_mutation(self):
  import time
  api=API();b=Bot(self.config(),api,Telegram(),object());b.lease_deadline=time.monotonic()-1
  self.assertRaises(SafeError,b.mutate,{'id':ID,'revision':1},123,1,'publish');self.assertEqual(api.calls,[])
 def test_test_mode_refuses_public_channel(self):
  class PostAPI(API):
   def call(self,action,*args,**kw):
    self.calls.append((action,args,kw))
    if action=='post_claim':return {'id':ID,'status':'sending','channel_id':'-100123456','mode':'test'}
  class Public(Telegram):
   def call(self,method,data,**kw):self.calls.append((method,data));return {'type':'channel','username':'public_channel'}
  api=PostAPI();tg=Public();Bot(self.config(),api,tg,object()).post();self.assertEqual([x[0] for x in tg.calls],['getChat']);self.assertEqual(api.calls[-1][2]['data']['status'],'failed')
 def test_definite_channel_rejection_is_retryable_failed(self):
  class PostAPI(API):
   def call(self,action,*args,**kw):
    self.calls.append((action,args,kw))
    if action=='post_claim':return {'id':ID,'status':'sending','channel_id':'-100123456','title':'Test','year':2026,'watch_url':'https://hdqaz.online/test','poster_url':''}
  class Rejected(Telegram):
   def call(self,*args,**kw):raise SafeError('rejected',True)
  api=PostAPI();Bot(self.config(),api,Rejected(),object()).post();self.assertEqual(api.calls[-1][2]['data']['status'],'failed')
 def test_manual_entry_does_not_call_tmdb(self):
  w={'id':ID,'revision':0,'kind':'movie','state':'draft','metadata':{}}
  api=API(w);tg=Telegram();b=Bot(self.config(),api,tg,object())
  u={'update_id':22,'callback_query':{'id':'x','from':{'id':123},'message':{'chat':{'id':123,'type':'private'}},'data':button(w,'manual','Manual')['callback_data']}}
  b.handle(u);self.assertEqual([x[0] for x in api.calls],['get']);self.assertIn('/edit title=',str(tg.calls))
 def test_search_failure_offers_manual_entry(self):
  class Offline(API):
   def call(self,action,*args,**kw):
    if action=='search':raise SafeError()
    return super().call(action,*args,**kw)
  w={'id':ID,'revision':0,'kind':'movie','state':'draft','metadata':{}}
  tg=Telegram();Bot(self.config(),Offline(w),tg,object()).handle(update(text='Movie name'))
  self.assertIn('Manual entry',str(tg.calls))
 def test_manual_metadata_edit(self):
  w={'id':ID,'revision':0,'kind':'movie','state':'draft','metadata':{'title':'Manual movie'}}
  api=API(w);Bot(self.config(),api,Telegram(),object()).handle(update(text='/edit genres=Драма, Экшн'))
  edit=[x for x in api.calls if x[0]=='edit'][0]
  self.assertEqual(edit[1][3]['genres'],['Драма','Экшн'])
if __name__=='__main__':unittest.main()
