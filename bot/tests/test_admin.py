import tempfile,unittest,uuid
from pathlib import Path
from types import SimpleNamespace
from hdqaz_bot.main import Bot
from hdqaz_bot.core import SafeError,button
from test_bot import Telegram,update,ID
from test_movie import API
class CatalogAPI(API):
 def __init__(self):
  super().__init__();self.actions=[];self.c={'id':ID,'title':'Existing title','year':2026,'kind':'series','section':'anime','is_published':True,'updated_at':'2026-10-04T00:00:00Z','genres':['Драма'],'is_premium':False,'seasons':[{'id':'s','season_number':1}],'episodes':[{'id':'e','season_id':'s','episode_number':1,'is_published':True,'hls_url':'https://cdn.hdqaz.online/old.m3u8'}],'workflows':[],'watch_url':'https://hdqaz.online/existing','channel_enabled':False}
 def call(self,action,*args,**kw):
  self.actions.append((action,args,kw))
  if action=='catalog':return {'items':[self.c.copy()],'has_next':False}
  if action=='catalog_get':return self.c.copy()
  if action=='admin_options':return {'genres':[{'name':'Драма'}],'dubbers':[]}
  if action=='new':self.w={**self.w,'kind':kw['data']['kind'],'metadata':{'section':kw['data'].get('section','default')}};return self.w.copy()
  if action=='existing':self.w['metadata']={'title':'Existing title','year':2026,'existing_content_id':ID,'section':'anime'};return self.w.copy()
  if action.startswith('catalog_'):return {'id':ID}
  return super().call(action,*args,**kw)
class AdminTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);p=Path(self.tmp.name);self.api=CatalogAPI();self.tg=Telegram();self.b=Bot(SimpleNamespace(admins={123},state_root=p,root=p),self.api,self.tg,object());self.addCleanup(self.b.movie.db.close);self.uid=100
 def cb(self,value):
  self.uid+=1;self.b.handle({'update_id':self.uid,'callback_query':{'id':'cb','from':{'id':123},'message':{'message_id':1,'chat':{'id':123,'type':'private'}},'data':value}})
 def text(self,text):
  self.uid+=1;u=update(text=text);u['update_id']=self.uid;self.b.handle(u)
 def test_home_and_add_separate_kind_from_section(self):
  self.text('/start');self.assertIn('Контент қосу',str(self.tg.calls));self.cb('aadd');self.cb('ak:movie');self.cb('sec:movie:anime');self.cb('movie_manual');self.assertEqual(self.api.w['kind'],'movie');self.assertEqual(self.api.w['metadata']['section'],'anime')
 def test_catalog_search_and_refresh_edit_one_message(self):
  self.cb('asearch');self.text('Existing');self.cb('crefresh');self.assertEqual(self.api.actions[-1][2]['data']['query'],'Existing');self.assertTrue(any(c[0]=='editMessageText' for c in self.tg.calls));self.assertNotIn(ID,str([c for c in self.tg.calls if c[0]=='send']))
 def test_edit_is_version_bound_and_requires_confirmation(self):
  self.cb('ce:'+ID.replace('-',''));self.cb('field:'+ID.replace('-','')+':title');self.text('New title');self.assertFalse(any(x[0]=='catalog_edit' for x in self.api.actions));s=self.b.movie.get(123);self.cb('save:'+s['nonce']);call=next(x for x in self.api.actions if x[0]=='catalog_edit');self.assertEqual(call[2]['data'],{'expected':'2026-10-04T00:00:00Z','patch':{'title':'New title'}})
 def test_old_confirmation_cannot_change_current_content(self):
  self.cb('cu:'+ID.replace('-',''));self.assertRaises(SafeError,self.cb,'pub:0');self.assertFalse(any(x[0]=='catalog_unpublish' for x in self.api.actions))
 def test_unpublish_needs_explicit_confirmation(self):
  self.cb('cu:'+ID.replace('-',''));self.assertFalse(any(x[0]=='catalog_unpublish' for x in self.api.actions));s=self.b.movie.get(123);self.cb('pub:'+s['nonce']);self.assertTrue(any(x[0]=='catalog_unpublish' for x in self.api.actions))
 def test_existing_series_only_asks_season_and_episode(self):
  self.cb('cn:'+ID.replace('-',''));self.assertEqual(self.b.movie.get(123)['mode'],'series_number');self.cb('snum:1');self.cb('snum:2');self.assertEqual(self.api.w['metadata']['episode_number'],2);self.assertEqual(self.api.w['metadata']['existing_content_id'],ID);self.assertFalse(any(x[0]=='search' for x in self.api.actions));self.cb(button(self.api.w,'video','')['callback_data']);self.assertEqual(self.b.movie.get(123)['mode'],'video')
 def test_new_manual_series_requires_numbers_before_video(self):
  self.api.w.update(kind='series',metadata={'title':'Series','year':2026});self.cb(button(self.api.w,'confirm','')['callback_data']);self.assertEqual(self.b.movie.get(123)['mode'],'series_number');self.assertFalse(any(x[0] in ('prepare','activate') for x in self.api.actions))
 def test_published_card_offers_safe_share_and_disabled_channel(self):
  self.cb('ci:'+ID.replace('-',''));c=self.tg.calls[-1][1];self.assertIn('https://wa.me/',str(c));self.assertIn('channeloff',str(c));self.assertNotIn('/source',c['text']);self.assertNotIn(ID,c['text']);self.cb('channeloff');self.assertFalse(any(x[0]=='catalog_post' for x in self.api.actions))
 def test_bad_queue_page_and_row_do_not_block_next_start(self):
  original=self.api.call
  self.api.call=lambda action,*a,**kw: [None,{},'bad',{'id':ID,'revision':0,'state':'draft','metadata':{'title':42},'job':[]}] if action=='queue' else original(action,*a,**kw)
  self.b.movie.panel(123,'test',page='bad');self.cb('qnext');self.text('/start');self.assertEqual(self.tg.calls[-1][0],'send')

 def test_media_upload_updates_only_existing_field(self):
  from unittest.mock import patch
  self.cb('cmup:'+ID.replace('-','')+':poster_url')
  u=update();u['update_id']=500;u['message']['photo']=[{'file_id':'image','file_size':100}]
  with patch('hdqaz_bot.admin.upload',return_value='https://cdn.hdqaz.online/poster/test.webp'):self.b.handle(u)
  self.assertTrue(any(x[0]=='catalog_get' for x in self.api.actions));self.assertFalse(any(x[0] in ('prepare','activate','publish') for x in self.api.actions))
 def test_workflow_banner_optional_and_stays_draft(self):
  from unittest.mock import patch
  self.cb('wm:'+ID.replace('-','')+':banner_url');u=update();u['update_id']=501;u['message']['document']={'file_id':'image','file_size':100}
  with patch('hdqaz_bot.admin.upload',return_value='https://cdn.hdqaz.online/banner/test.webp'):self.b.handle(u)
  self.assertFalse(any(x[0] in ('source','prepare','activate','publish') for x in self.api.actions))

 def test_existing_web_movie_goes_directly_to_video(self):
  self.api.c.update(kind='movie',is_published=False,hls_url=None,section='default');self.cb('attach:'+ID.replace('-',''));self.assertEqual(self.b.movie.get(123)['mode'],'video');self.assertEqual(self.api.w['metadata']['existing_content_id'],ID);self.assertFalse(any(x[0]=='search' for x in self.api.actions))
 def test_published_movie_cannot_attach_replacement(self):
  self.api.c.update(kind='movie',is_published=True);self.assertRaises(SafeError,self.cb,'attach:'+ID.replace('-',''))

 def test_static_webp_sticker_is_routed_only_in_media_mode(self):
  from unittest.mock import patch
  self.cb('cmup:'+ID.replace('-','')+':poster_url');u=update();u['update_id']=502;u['message']['sticker']={'file_id':'image','file_size':100,'is_animated':False}
  with patch('hdqaz_bot.admin.upload',return_value='https://test.supabase.co/storage/v1/object/public/content-media/posters/test.webp') as upload:self.b.handle(u);upload.assert_called_once()
  self.assertFalse(any(x[0] in ('source','prepare','activate','publish') for x in self.api.actions))
