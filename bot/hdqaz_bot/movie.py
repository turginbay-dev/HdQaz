"""Durable private movie conversation; existing backend remains workflow authority."""
import json
import sqlite3
import shutil
import uuid
from pathlib import Path
from .core import SafeError,button,callback,request_key
from .ingestion import stage_local

FIELDS=[('title','🎬 Кино атауын жазыңыз'),('year','📅 Шыққан жылы'),('description','📝 Сипаттама'),('country','🌍 Ел'),('genres','🎭 Жанрлар (үтірмен бөліңіз)'),('duration_minutes','⏱ Ұзақтығы (минут)'),('is_premium','💎 Premium?')]
class MovieFlow:
 def __init__(self,bot):
  self.b=bot;root=Path(bot.c.state_root);root.mkdir(mode=0o700,parents=True,exist_ok=True)
  self.db=sqlite3.connect(root/'conversation.sqlite');self.db.execute('pragma journal_mode=WAL');self.db.execute('pragma synchronous=FULL')
  self.db.execute('create table if not exists sessions(actor integer primary key, data text not null)');self.db.commit()
 def get(self,actor):
  row=self.db.execute('select data from sessions where actor=?',(actor,)).fetchone();return json.loads(row[0]) if row else None
 def save(self,actor,s):
  self.db.execute('insert or replace into sessions values(?,?)',(actor,json.dumps(s)));self.db.commit()
 def clear(self,actor):self.db.execute('delete from sessions where actor=?',(actor,));self.db.commit()
 def prompt(self,actor,s):
  if s['mode']=='video':self.b.tg.send(actor,'🎞 Кино файлын осы чатқа жіберіңіз немесе forward жасаңыз. MP4, MOV, MKV немесе WebM. Жариялау бөлек растауды қажет етеді.');return
  field,label=FIELDS[s['step']]
  buttons=None
  if field=='is_premium':
   w=self.b.api.call('get',actor,s['id']);yes=button(w,'premiumyes','Иә');no=button(w,'premiumno','Жоқ')
   s.update(yes=yes['callback_data'],no=no['callback_data']);self.save(actor,s);buttons=[[yes,no]]
  self.b.tg.send(actor,label,buttons)
 def handle(self,u,actor):
  b=self.b;cb=u.get('callback_query');value=cb.get('data','') if cb else '';uid=u['update_id'];s=self.get(actor)
  premium=bool(cb and s and value in (s.get('yes'),s.get('no')))
  if cb and value in ('menu_movie','menu_series'):self.clear(actor);return False
  if cb and not premium:
   try:wid,rev,action=callback(value)
   except SafeError:return False
   if action not in ('manual','video','cancel'):return False
   w=b.api.call('get',actor,wid)
   if w['kind']!='movie':return False
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']})
   if w['state']!='draft' or w['revision']!=rev:raise SafeError('stale')
   if action=='cancel':
    self.clear(actor);b.tg.send(actor,'Мәліметтер сақталды.',[[{'text':'🎬 Жаңа кино','callback_data':'menu_movie'},{'text':'📋 Кезек','callback_data':'menu_queue'}]]);return True
   if action=='video' and (not w['metadata'].get('title') or not w['metadata'].get('year')):raise SafeError('metadata_required')
   s={'id':wid,'mode':'manual' if action=='manual' else 'video','step':0,'last':uid};self.save(actor,s);self.prompt(actor,s);return True
  message=u.get('message',{});media=message.get('video') or message.get('document')
  if media:
   if not s or s['mode'] not in ('video','ingest'):
    b.tg.send(actor,'Алдымен Movie мәліметтерін толтырып, 🎞 Видео қосу түймесін басыңыз.');return True
   return self.ingest(actor,u,s,media)
  if not s or s['mode']!='manual':return False
  text=message.get('text','').strip()
  if text.startswith('/') or (cb and not premium):return False
  if uid<=s.get('last',-1):self.prompt(actor,s);return True
  field,_=FIELDS[s['step']]
  if cb:
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']})
   if field!='is_premium':raise SafeError('stale')
   val=value==s['yes']
  elif field=='is_premium':self.prompt(actor,s);return True
  elif field in ('year','duration_minutes'):
   try:val=int(text)
   except ValueError:self.prompt(actor,s);return True
   if not (1888<=val<=2200 if field=='year' else 1<=val<=10080):self.prompt(actor,s);return True
  elif field=='genres':val=[x.strip() for x in text.split(',') if x.strip()]
  else:val=text
  w=b.api.call('get',actor,s['id'])
  if w['state']!='draft':self.clear(actor);raise SafeError('stale')
  w=b.mutate(w,actor,uid,'edit',{**w['metadata'],field:val});s['last']=uid;s['step']+=1
  if s['step']==len(FIELDS):self.clear(actor);b.show(actor,w)
  else:self.save(actor,s);self.prompt(actor,s)
  return True
 def ingest(self,actor,u,s,media):
  b=self.b;uid=u['update_id']
  if b.c.telegram_base!='http://telegram-api:8081':raise SafeError('local_api_required')
  size=media.get('file_size');file_id=media.get('file_id')
  if type(size) is not int or not 0<size<=b.c.max_source or not isinstance(file_id,str) or not 1<=len(file_id)<=1024:raise SafeError('invalid_source')
  mime=media.get('mime_type','')
  if mime not in ('video/mp4','video/quicktime','video/x-matroska','video/webm','application/octet-stream'):raise SafeError('invalid_media')
  if s['mode']=='ingest' and s.get('update')!=uid:raise SafeError('upload_busy')
  w=b.api.call('get',actor,s['id'])
  if s.get('file_id')==file_id:uid=s.get('update',uid)
  ref=str(uuid.uuid5(uuid.NAMESPACE_URL,f'hdqaz-telegram:{actor}:{w["id"]}:{uid}'))
  if w['state']=='submitted' and w.get('source_ref')==ref:self.clear(actor);b.show(actor,w);return True
  if w['state'] not in ('draft','staging'):raise SafeError('stale')
  if not w['metadata'].get('title') or not w['metadata'].get('year'):raise SafeError('metadata_required')
  if shutil.disk_usage(b.c.root).free<size*3+2*1024**3:raise SafeError('storage_full')
  s.update(mode='ingest',update=uid,file_id=file_id);self.save(actor,s)
  b.tg.send(actor,'✅ Видео қабылданды\n⬇️ Серверге жүктелуде… Үлкен файлға уақыт қажет. Жарияланбайды.')
  b.downloading=True
  try:
   if w['state']=='draft':
    try:b.sources.source(ref)
    except (OSError,SafeError):
     file=b.tg.call('getFile',{'file_id':file_id},timeout=3600);b.guard()
     if file.get('file_size')!=size:raise SafeError('source_changed')
     stage_local(b.c.telegram_root,file['file_path'],b.c.root/'inbox',ref,size,b.c.max_source,check=b.guard)
    if w.get('source_ref')!=ref:w=b.mutate(w,actor,uid,'source',{'source_ref':ref})
    w=b.mutate(w,actor,uid,'prepare',{'source_ref':ref})
   if w['source_ref']!=ref:raise SafeError('source_conflict')
   b.sources.stage(ref,w['job_id']);w=b.mutate(w,actor,uid,'activate')
   self.clear(actor);b.show(actor,b.api.call('get',actor,w['id']))
  except (SafeError,OSError,KeyError,ValueError):
   s.update(mode='video');self.save(actor,s)
   raise
  finally:b.downloading=False
  return True
