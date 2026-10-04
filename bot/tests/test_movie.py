import tempfile,unittest,uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from hdqaz_bot.main import Bot
from hdqaz_bot.core import SafeError,Sources,button
from test_bot import Telegram,update,ID

class API:
 def __init__(self):self.w={'id':ID,'revision':0,'kind':'movie','state':'draft','metadata':{}};self.calls=[]
 def call(self,action,*args,**kw):
  self.calls.append(action)
  if action=='queue':return [self.w.copy()]
  if action in ('get','new'):return self.w.copy()
  data=args[3] if len(args)>3 else kw.get('data',{})
  if action=='edit':self.w['metadata']=data
  if action=='select':self.w['metadata']=data
  if action=='source':self.w['source_ref']=data['source_ref']
  if action=='prepare':self.w.update(state='staging',job_id='22222222-2222-4222-8222-222222222222')
  if action=='activate':self.w.update(state='submitted')
  self.w['revision']+=1
  return self.w.copy()
class MovieTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);root=Path(self.tmp.name)
  (root/'inbox').mkdir();(root/'tg').mkdir()
  self.c=SimpleNamespace(admins={123},state_root=root/'state',root=root,telegram_root=root/'tg',telegram_base='http://telegram-api:8081',max_source=100000)
  self.api=API();self.tg=Telegram();self.b=Bot(self.c,self.api,self.tg,Sources(self.c))
  self.addCleanup(self.b.movie.db.close)
 def cb(self,action,n=1):
  self.b.handle({'update_id':n,'callback_query':{'id':'x','from':{'id':123},'message':{'message_id':1,'chat':{'id':123,'type':'private'}},'data':button(self.api.w,action,'x')['callback_data']}})
 def test_manual_conversation_is_durable(self):
  self.cb('manual');u=update(text='My movie');u['update_id']=2;self.b.handle(u)
  self.assertEqual(self.api.w['metadata']['title'],'My movie')
  self.assertEqual(self.b.movie.get(123)['step'],1)
  self.b.movie.handle(u,123);self.assertEqual(self.b.movie.get(123)['step'],1)
 def test_complete_manual_prompts_and_bound_premium(self):
  self.cb('manual')
  for uid,text in enumerate(['Movie','2026','Description','Қазақстан','Драма, Экшн','90'],2):
   u=update(text=text);u['update_id']=uid;self.b.handle(u)
  s=self.b.movie.get(123)
  self.b.handle({'update_id':8,'callback_query':{'id':'p','from':{'id':123},'message':{'chat':{'id':123,'type':'private'}},'data':s['no']}})
  self.assertFalse(self.api.w['metadata']['is_premium']);self.assertEqual(self.b.movie.get(123)['mode'],'review')
  self.assertIn('Видео қосу',str(self.tg.calls));self.assertNotIn('prepare',self.api.calls)
 def test_normal_movie_card_has_no_technical_instructions(self):
  self.api.w.update(source_ref='33333333-3333-4333-8333-333333333333')
  self.api.w['metadata']={'title':'Movie','year':2026,'dubber_id':'44444444-4444-4444-8444-444444444444'}
  self.b.show(123,self.api.w);text=self.tg.calls[-1][1][1]
  for forbidden in ['/edit','/source','UUID','33333333','44444444','draft']:self.assertNotIn(forbidden,text)
  rendered=str(self.tg.calls[-1]);self.assertIn('Дұрыс',rendered);self.assertIn('Өзгерту',rendered);self.assertIn('Видео қосу',rendered);self.assertIn('Бас тарту',rendered)
 def test_normal_ready_card_has_review_and_explicit_publish_only(self):
  self.api.w.update(state='submitted',job={'id':'secret-job-id','status':'ready','progress_percent':100,'attempt_count':1,'max_attempts':3,'output_manifest_url':'https://cdn.hdqaz.online/candidates/test/master.m3u8'})
  self.b.show(123,self.api.w);text=self.tg.calls[-1][1][1]
  self.assertIn('100%',text);self.assertNotIn('secret-job-id',text);self.assertNotIn('m3u8',text)
  self.assertIn('publish',str(self.tg.calls[-1]));self.assertNotIn('publish',self.api.calls)
 def test_movie_menu_offers_tmdb_and_manual_without_empty_draft(self):
  u={'update_id':22,'callback_query':{'id':'x','from':{'id':123},'message':{'message_id':55,'chat':{'id':123,'type':'private'}},'data':'menu_movie'}}
  self.b.handle(u);self.assertFalse(self.api.calls)
  self.assertIn('TMDB арқылы табу',str(self.tg.calls));self.assertIn('Қолмен енгізу',str(self.tg.calls))
 def test_queue_is_one_compact_message_and_refresh_reuses_it(self):
  self.api.w.update(metadata={'title':'Avatar','year':2026},job={'status':'processing','progress_percent':63})
  self.b.movie.queue(123)
  sends=[c for c in self.tg.calls if c[0]=='send'];self.assertEqual(len(sends),1)
  text=sends[0][1][1];self.assertIn('📋 Кезек',text);self.assertIn('Avatar',text);self.assertIn('63%',text)
  self.assertNotIn(ID,text);self.assertNotIn('job',text.lower());before=len(self.tg.calls);self.api.w['job']['progress_percent']=64
  u={'update_id':40,'callback_query':{'id':'r','from':{'id':123},'message':{'message_id':1,'chat':{'id':123,'type':'private'}},'data':'qrefresh'}}
  self.b.handle(u);events=self.tg.calls[before:]
  self.assertEqual([c[0] for c in events],['answerCallbackQuery','editMessageText'])
  self.assertEqual(events[1][1]['message_id'],1);self.assertIn('64%',events[1][1]['text'])
  self.assertEqual(len([c for c in self.tg.calls if c[0]=='send']),1)
 def test_queue_row_opens_detail_by_editing_same_message(self):
  self.api.w.update(metadata={'title':'Dune','year':2024})
  self.b.movie.queue(123);before=len([c for c in self.tg.calls if c[0]=='send'])
  data='qrow:'+ID.replace('-','')+':0';u={'update_id':41,'callback_query':{'id':'r','from':{'id':123},'message':{'message_id':1,'chat':{'id':123,'type':'private'}},'data':data}}
  self.b.handle(u);self.assertEqual(len([c for c in self.tg.calls if c[0]=='send']),before)
  self.assertEqual(self.tg.calls[-1][0],'editMessageText');self.assertIn('Dune',self.tg.calls[-1][1]['text'])
 def test_tmdb_unavailable_fallback_and_search_results_share_panel(self):
  self.b.movie.choice(123,55);u={'update_id':5,'callback_query':{'id':'x','from':{'id':123},'message':{'message_id':55,'chat':{'id':123,'type':'private'}},'data':'movie_tmdb'}}
  self.b.handle(u);u2=update(text='Avatar');u2['update_id']=6;self.b.api.call=lambda *a,**kw: (_ for _ in ()).throw(SafeError())
  self.b.handle(u2);self.assertIn('TMDB қазір қолжетімсіз',self.tg.calls[-1][1]['text']);self.assertEqual(self.tg.calls[-1][0],'editMessageText')
 def test_tmdb_search_shows_small_inline_result_list_on_same_screen(self):
  self.b.movie.choice(123,55);menu={'update_id':5,'callback_query':{'id':'x','from':{'id':123},'message':{'message_id':55,'chat':{'id':123,'type':'private'}},'data':'movie_tmdb'}};self.b.handle(menu)
  self.api.call=lambda action,*a,**kw: [{'tmdb_id':1,'title':'Avatar','year':2009},{'tmdb_id':2,'title':'Avatar: The Way of Water','year':2022}] if action=='search' else []
  u=update(text='Avatar');u['update_id']=6;before=len([c for c in self.tg.calls if c[0]=='send']);self.b.handle(u)
  self.assertEqual(len([c for c in self.tg.calls if c[0]=='send']),before);self.assertEqual(self.tg.calls[-1][0],'editMessageText')
  keyboard=self.tg.calls[-1][1]['reply_markup']['inline_keyboard'];self.assertEqual(len(keyboard),3);self.assertIn('Avatar',str(keyboard));self.assertIn('Қолмен енгізу',str(keyboard))
 def test_tmdb_selection_populates_metadata_and_shows_clean_review(self):
  self.b.movie.choice(123,55);w=self.api.w.copy();w['metadata']={'title':'Avatar','year':2009,'description':'Adventure','country':'US','genres':['Фантастика'],'duration_minutes':162,'poster_url':'https://image.tmdb.org/t/p/w780/avatar.jpg','banner_url':'https://image.tmdb.org/t/p/w780/banner.jpg'}
  calls=[]
  def call(action,*args,**kw):
   calls.append(action)
   if action=='new':return {'id':ID,'revision':0,'kind':'movie','state':'draft','metadata':{}}
   if action=='select':return w
   return self.api.w
  self.api.call=call
  data={'update_id':7,'callback_query':{'id':'x','from':{'id':123},'message':{'message_id':55,'chat':{'id':123,'type':'private'}},'data':'tmdbselect:19995'}}
  self.b.handle(data);self.assertEqual(calls,['new','select']);self.assertIn('Avatar',self.tg.calls[-1][1]['text']);self.assertIn('162 мин',self.tg.calls[-1][1]['text']);self.assertIn('image.tmdb.org',w['metadata'].get('poster_url',''))
  self.assertIn('confirm',str(self.tg.calls[-1][1]['reply_markup']))
 def test_file_requires_explicit_draft_selection(self):
  u=update();u['message']['video']={'file_id':'x','file_size':100,'mime_type':'video/mp4'}
  self.b.handle(u);self.assertNotIn('prepare',self.api.calls)
 def test_unauthorized_file_never_ingested(self):
  u=update(456);u['message']['video']={'file_id':'x','file_size':100};self.b.handle(u);self.assertEqual(self.api.calls,[])
 def test_received_file_uses_existing_handoff_without_publish(self):
  self.api.w['metadata']={'title':'Test','year':2026};self.cb('video')
  source=self.c.telegram_root/'file';source.write_bytes(b'\x00\x00\x00\x18ftypisom'+b'x'*100)
  orig=self.tg.call
  self.tg.call=lambda method,*a,**kw: {'file_path':str(source),'file_size':source.stat().st_size} if method=='getFile' else orig(method,*a,**kw)
  u=update();u['message']['video']={'file_id':'file1','file_size':source.stat().st_size,'mime_type':'video/mp4'}
  with patch('hdqaz_bot.movie.shutil.disk_usage',return_value=SimpleNamespace(free=10**12)):self.b.handle(u)
  self.assertEqual(self.api.w['state'],'submitted');self.assertNotIn('publish',self.api.calls)
  self.assertTrue((self.c.root/(self.api.w['job_id']+'.media')).exists());self.assertIsNone(self.b.movie.get(123))
 def test_download_failure_can_be_retried(self):
  self.api.w['metadata']={'title':'Test','year':2026};self.cb('video')
  self.tg.call=lambda *a,**kw: (_ for _ in ()).throw(SafeError())
  u=update();u['message']['video']={'file_id':'file1','file_size':100,'mime_type':'video/mp4'}
  with patch('hdqaz_bot.movie.shutil.disk_usage',return_value=SimpleNamespace(free=10**12)):
   self.assertRaises(SafeError,self.b.handle,u)
  self.assertEqual(self.b.movie.get(123)['mode'],'video');self.assertNotIn('prepare',self.api.calls)
if __name__=='__main__':unittest.main()
