"""Durable private movie conversation; existing backend remains workflow authority."""
import json
import sqlite3
import shutil
import threading
import uuid
from pathlib import Path
from .core import SafeError,button,callback,request_key
from .ingestion import stage_local

FIELDS=[('title','🎬 Кино атауын жазыңыз'),('year','📅 Шыққан жылы'),('description','📝 Сипаттама'),('country','🌍 Ел'),('genres','🎭 Жанрлар (үтірмен бөліңіз)'),('duration_minutes','⏱ Ұзақтығы (минут)'),('is_premium','💎 Premium?')]
class MovieFlow:
 def __init__(self,bot):
  self.b=bot;root=Path(bot.c.state_root);root.mkdir(mode=0o700,parents=True,exist_ok=True)
  self.db=sqlite3.connect(root/'conversation.sqlite',check_same_thread=False);self.db_lock=threading.RLock();self.db.execute('pragma journal_mode=WAL');self.db.execute('pragma synchronous=FULL')
  self.db.execute('create table if not exists sessions(actor integer primary key, data text not null)');self.db.execute('create table if not exists panels(actor integer primary key, data text not null)');self.db.commit()
 def get(self,actor):
  with self.db_lock:
   row=self.db.execute('select data from sessions where actor=?',(actor,)).fetchone();return json.loads(row[0]) if row else None
 def save(self,actor,s):
  with self.db_lock:self.db.execute('insert or replace into sessions values(?,?)',(actor,json.dumps(s)));self.db.commit()
 def clear(self,actor):
  with self.db_lock:self.db.execute('delete from sessions where actor=?',(actor,));self.db.commit()
 def panel_state(self,actor):
  with self.db_lock:
   row=self.db.execute('select data from panels where actor=?',(actor,)).fetchone();return json.loads(row[0]) if row else {}
 def panel(self,actor,text,buttons=None,message_id=None,screen=None,page=None,workflow=None,confirmed=None):
  state=self.panel_state(actor);message_id=message_id or state.get('message_id')
  if screen is not None:state['screen']=screen
  if page is not None:state['page']=page
  if workflow is not None:state['workflow']=workflow
  if confirmed is not None:state['confirmed']=confirmed
  keyboard=buttons or [];fingerprint=json.dumps([text,keyboard],ensure_ascii=False,sort_keys=True)
  if message_id and state.get('fingerprint')!=fingerprint:
   try:self.b.tg.call('editMessageText',{'chat_id':actor,'message_id':message_id,'text':text[:3900],'link_preview_options':{'is_disabled':True},'reply_markup':{'inline_keyboard':keyboard}})
   except SafeError as e:
    if not e.definite:raise
    result=self.b.tg.send(actor,text,keyboard);message_id=result['message_id']
  elif not message_id:
   result=self.b.tg.send(actor,text,keyboard);message_id=result['message_id']
  state.update(message_id=message_id,fingerprint=fingerprint)
  with self.db_lock:self.db.execute('insert or replace into panels values(?,?)',(actor,json.dumps(state)));self.db.commit()
  return state
 def detail(self,actor,w,message_id=None):
  state=self.panel_state(actor);confirmed=bool(state.get('confirmed')) and state.get('workflow')==w['id']
  self.b.show_movie(actor,w,message_id=message_id,confirmed=confirmed)
 def new_movie(self,actor,uid,message_id,kind='movie'):
  w=self.b.api.call('new',actor,data={'kind':kind},key=request_key(actor,uid,'new'))
  self.save(actor,{'id':w['id'],'mode':'manual','step':0,'last':uid,'message_id':message_id})
  self.prompt(actor,self.get(actor));return w
 def choice(self,actor,message_id):
  return self.panel(actor,'🎬 Киноны қалай қосамыз?',[[{'text':'🔎 TMDB арқылы табу','callback_data':'movie_tmdb'},{'text':'✍️ Қолмен енгізу','callback_data':'movie_manual'}]],message_id,'movie_choice',workflow=None,confirmed=False)
 def queue(self,actor,page=0,message_id=None):
  rows=self.b.api.call('queue',actor)
  rows=[w for w in rows if w.get('state') not in ('published',)]
  if type(page) is not int or page<0:page=0
  size=5;pages=max(1,(len(rows)+size-1)//size);page=max(0,min(page,pages-1));items=rows[page*size:(page+1)*size]
  lines=['📋 Кезек'];buttons=[]
  if not items:lines.append('Кезек бос.')
  for i,w in enumerate(items,page*size+1):
   m=w.get('metadata') or {};j=w.get('job') or {};status={'draft':'✏️ Draft','staging':'⬇️ Қабылдау','rejected':'❌ Қабылданбады'}.get(w['state'],'⬇️ Кезекте')
   if j:status={'queued':'⬇️ '+str(j.get('progress_percent',0))+'%','processing':'⚙️ '+str(j.get('progress_percent',0))+'%','uploading':'☁️ '+str(j.get('progress_percent',0))+'%','ready':'✅ Ready','failed':'❌ Failed'}.get(j.get('status'),status)
   title=(m.get('title') or 'Жаңа кино').replace('\n',' ')[:36]
   lines.append(f'{i}. 🎬 {title} — {status}')
   buttons.append([{'text':f'{i}. {title[:40]}','callback_data':'qrow:'+w['id'].replace('-','')+':'+str(w['revision'])}])
  nav=[]
  if page:nav.append({'text':'◀️','callback_data':'qprev'})
  nav.append({'text':'🔄 Жаңарту','callback_data':'qrefresh'})
  if page<pages-1:nav.append({'text':'▶️','callback_data':'qnext'})
  buttons.append(nav);self.panel(actor,'\n'.join(lines),buttons,message_id,'queue',page)
 def open_row(self,actor,wid,revision,message_id):
  w=self.b.api.call('get',actor,wid)
  if w['revision']!=revision:raise SafeError('stale')
  self.save(actor,{'id':wid,'mode':'detail','step':0,'last':0,'message_id':message_id})
  state=self.panel_state(actor);state.update(screen='detail',workflow=wid,confirmed=False)
  with self.db_lock:self.db.execute('insert or replace into panels values(?,?)',(actor,json.dumps(state)));self.db.commit()
  self.detail(actor,w,message_id)
 def prompt(self,actor,s):
  if s['mode']=='video':self.panel(actor,'🎞 Кино файлын осы чатқа жіберіңіз немесе forward жасаңыз. MP4, MOV, MKV немесе WebM.',[[{'text':'🔙 Карточка','callback_data':'mcard'}]],s.get('message_id'),'movie_video',workflow=s['id'],confirmed=True);return
  field,label=FIELDS[s['step']]
  buttons=None
  if field=='is_premium':
   w=self.b.api.call('get',actor,s['id']);yes=button(w,'premiumyes','Иә');no=button(w,'premiumno','Жоқ')
   s.update(yes=yes['callback_data'],no=no['callback_data']);self.save(actor,s);buttons=[[yes,no]]
  self.panel(actor,label,buttons,s.get('message_id'),'movie_manual',workflow=s['id'],confirmed=False)
 def handle(self,u,actor):
  b=self.b;cb=u.get('callback_query');value=cb.get('data','') if cb else '';uid=u['update_id'];s=self.get(actor)
  premium=bool(cb and s and value in (s.get('yes'),s.get('no')))
  if cb and value=='menu_movie':
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});self.clear(actor);self.choice(actor,cb['message']['message_id']);return True
  if cb and value=='menu_queue':
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});self.queue(actor,0,cb['message']['message_id']);return True
  if cb and value in ('qrefresh','qprev','qnext'):
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});state=self.panel_state(actor);page=state.get('page',0)+(1 if value=='qnext' else -1 if value=='qprev' else 0);self.queue(actor,page,cb['message']['message_id']);return True
  if cb and value.startswith('qrow:'):
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});parts=value.split(':');wid=str(uuid.UUID(hex=parts[1]));self.open_row(actor,wid,int(parts[2]),cb['message']['message_id']);return True
  if cb and value=='qback':
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});self.queue(actor,self.panel_state(actor).get('page',0),cb['message']['message_id']);return True
  if cb and value=='movie_tmdb':
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});s={'mode':'tmdb_query','step':0,'last':u['update_id'],'message_id':cb['message']['message_id']};self.save(actor,s);self.panel(actor,'🔎 Киноның атауын жазыңыз.',[[{'text':'✍️ Қолмен енгізу','callback_data':'movie_manual'}]],s['message_id'],'tmdb_query');return True
  if cb and value=='movie_manual':
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});self.clear(actor);self.new_movie(actor,u['update_id'],cb['message']['message_id']);return True
  if cb and value=='movie_search_manual':
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});self.clear(actor);self.new_movie(actor,u['update_id'],cb['message']['message_id']);return True
  if cb and value.startswith('tmdbselect:'):
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});tmdb=int(value.split(':',1)[1]);w=b.api.call('new',actor,data={'kind':'movie'},key=request_key(actor,u['update_id'],'new'));w=b.api.call('select',actor,w['id'],w['revision'],{'tmdb_id':tmdb},request_key(actor,u['update_id'],'select'));self.save(actor,{'id':w['id'],'mode':'review','step':0,'last':u['update_id'],'message_id':cb['message']['message_id']});self.panel(actor,'✅ Кино таңдалды. Мәліметтерді қарап шығыңыз.',[[button(w,'confirm','✅ Дұрыс'),button(w,'manual','✏️ Өзгерту')],[button(w,'cancel','❌ Бас тарту')]],cb['message']['message_id'],'movie_review',w['id'],confirmed=False);self.detail(actor,w,cb['message']['message_id']);return True
  if cb and value=='mcard':
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});state=self.get(actor);w=b.api.call('get',actor,state['id']);self.detail(actor,w,cb['message']['message_id']);return True
  if cb and value in ('menu_series',):self.clear(actor);return False
  if cb and not premium:
   try:wid,rev,action=callback(value)
   except SafeError:return False
   if action not in ('manual','video','cancel','confirm','get','publish','reject','retry'):return False
   w=b.api.call('get',actor,wid)
   if w['kind']!='movie':return False
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']})
   if w['revision']!=rev:raise SafeError('stale')
   if action in ('cancel','manual','video','confirm') and w['state']!='draft':raise SafeError('stale')
   if action=='cancel':
    self.clear(actor);self.panel(actor,'Мәліметтер сақталды.',[[{'text':'🎬 Жаңа кино','callback_data':'menu_movie'},{'text':'📋 Кезек','callback_data':'menu_queue'}]],cb['message']['message_id'],'home');return True
   if action=='manual':
    s={'id':wid,'mode':'manual','step':0,'last':uid,'message_id':cb['message']['message_id']};self.save(actor,s);self.prompt(actor,s);return True
   if action=='confirm':
    self.panel_state(actor);self.panel(actor,'🎞 Енді кино файлын жіберіңіз немесе forward жасаңыз.',[[{'text':'🔙 Карточка','callback_data':'mcard'}]],cb['message']['message_id'],'movie_video',wid,confirmed=True);self.save(actor,{'id':wid,'mode':'video','step':0,'last':uid,'message_id':cb['message']['message_id'],'confirmed':True});return True
   if action=='video' and (not w['metadata'].get('title') or not w['metadata'].get('year')):raise SafeError('metadata_required')
   if action=='video':
    s={'id':wid,'mode':'video','step':0,'last':uid,'message_id':cb['message']['message_id'],'confirmed':True};self.save(actor,s);self.prompt(actor,s);return True
   if action in ('get','publish','reject','retry'):
    if action!='get':w=b.mutate(w,actor,uid,action)
    w=b.api.call('get',actor,wid);self.detail(actor,w,cb['message']['message_id']);return True
  message=u.get('message',{});media=message.get('video') or message.get('document')
  if media:
   if not s or s['mode'] not in ('video','ingest') or not s.get('confirmed'):
    b.tg.send(actor,'Алдымен Movie мәліметтерін толтырып, 🎞 Видео қосу түймесін басыңыз.');return True
   return self.ingest(actor,u,s,media)
  if not s:return False
  text=message.get('text','').strip()
  if s['mode']=='tmdb_query' and text and not text.startswith('/'):
   try:results=b.api.call('search',actor,data={'kind':'movie','query':text})
   except SafeError:
    self.panel(actor,'TMDB қазір қолжетімсіз. Қолмен енгізіңіз.',[[{'text':'✍️ Қолмен енгізу','callback_data':'movie_search_manual'}]],s.get('message_id'),'tmdb_fallback');return True
   buttons=[[{'text':(r['title']+' · '+str(r.get('year') or '—'))[:56],'callback_data':'tmdbselect:'+str(r['tmdb_id'])}] for r in results[:6]]
   buttons.append([{'text':'✍️ Қолмен енгізу','callback_data':'movie_search_manual'}])
   self.panel(actor,'🔎 Нәтижені таңдаңыз:',buttons,s.get('message_id'),'tmdb_results');return True
  if s['mode']=='detail':return False
  if s['mode']!='manual':return False
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
  if s['step']==len(FIELDS):
   s.update(mode='review',confirmed=False);self.save(actor,s)
   self.panel(actor,'✅ Мәліметтер дайын. Кино карточкасын қарап шығыңыз.',[[button(w,'confirm','✅ Дұрыс'),button(w,'manual','✏️ Өзгерту')],[button(w,'cancel','❌ Бас тарту')]],s.get('message_id'),'movie_review',w['id'],confirmed=False);self.detail(actor,w,s.get('message_id'))
  else:self.save(actor,s);self.prompt(actor,s)
  return True
 def ingest(self,actor,u,s,media):
  b=self.b;uid=u['update_id']
  if b.c.telegram_base!='http://telegram-api:8081':raise SafeError('local_api_required')
  size=media.get('file_size');file_id=media.get('file_id')
  if type(size) is not int or not 0<size<=b.c.max_source or not isinstance(file_id,str) or not 1<=len(file_id)<=1024:raise SafeError('invalid_source')
  mime=media.get('mime_type','')
  if mime not in ('video/mp4','video/quicktime','video/x-matroska','video/webm','application/octet-stream'):raise SafeError('invalid_media')
  if s['mode']=='ingest' and s.get('file_id')!=file_id:raise SafeError('upload_busy')
  if b.ingestion_active():
   if b.ingestion_active(actor,file_id):return True
   b.tg.send(actor,'Басқа видео қабылданып жатыр. Аяқталған соң қайта жіберіңіз.');return True
  w=b.api.call('get',actor,s['id'])
  if s.get('file_id')==file_id:uid=s.get('update',uid)
  ref=str(uuid.uuid5(uuid.NAMESPACE_URL,f'hdqaz-telegram:{actor}:{w["id"]}:{uid}'))
  if w['state']=='submitted' and w.get('source_ref')==ref:self.clear(actor);b.show(actor,w);return True
  if w['state'] not in ('draft','staging'):raise SafeError('stale')
  if not w['metadata'].get('title') or not w['metadata'].get('year'):raise SafeError('metadata_required')
  if shutil.disk_usage(b.c.root).free<size*3+2*1024**3:raise SafeError('storage_full')
  s.update(mode='ingest',update=uid,file_id=file_id,source_ref=ref,file_size=size);self.save(actor,s)
  b.tg.send(actor,'✅ Видео қабылданды\n⬇️ Серверге жүктелуде… Үлкен файлға уақыт қажет. Жарияланбайды.')
  if not b.start_ingestion(self._ingest_background,actor,uid,s.copy(),size,file_id,ref,identity=(actor,file_id)):
   current=self.get(actor)
   if current and current.get('mode')=='ingest':return True
   raise SafeError('upload_busy')
  return True
 def _ingest_background(self,actor,uid,s,size,file_id,ref):
  b=self.b
  try:
   w=b.api.call('get',actor,s['id'])
   if w['state']=='draft':
    try:b.sources.source(ref)
    except (OSError,SafeError):
     file=b.tg.call('getFile',{'file_id':file_id},timeout=3600);b.guard()
     if file.get('file_size')!=size:raise SafeError('source_changed')
     stage_local(b.c.telegram_root,file['file_path'],b.c.root/'inbox',ref,size,b.c.max_source,check=b.guard)
    if w.get('source_ref')!=ref:w=b.mutate(w,actor,uid,'source',{'source_ref':ref})
    w=b.mutate(w,actor,uid,'prepare',{'source_ref':ref})
   if w.get('source_ref')!=ref:raise SafeError('source_conflict')
   b.sources.stage(ref,w['job_id']);w=b.mutate(w,actor,uid,'activate')
   self.clear(actor);b.show(actor,b.api.call('get',actor,w['id']))
  except (SafeError,OSError,KeyError,ValueError) as exc:
   s.update(mode='video');self.save(actor,s)
   errors={'storage_full':'Серверде бос орын жеткіліксіз. Файлды өңдеуге жібермедім.', 'invalid_media':'MP4, MOV, MKV немесе WebM видео жіберіңіз.', 'invalid_source':'Файлдың көлемі не түрі жарамсыз.', 'download_timeout':'Жүктеу уақыты аяқталды. Сол видеоны қайта жіберіңіз.', 'source_io':'Файл қабылданбады. Сол видеоны қайта жіберіңіз.'}
   try:b.tg.send(actor,errors.get(getattr(exc,'code',''),'Файл қабылданбады. Қайта жіберіп көріңіз.'))
   except Exception:pass
  except Exception:
   s.update(mode='video');self.save(actor,s)
   try:b.tg.send(actor,'Файлды қабылдау аяқталмады. Сол видеоны қайта жіберіп көріңіз.')
   except Exception:pass
   print('{"event":"movie_ingestion_failed"}',flush=True)
  finally:
   with b.ingestion_lock:b.downloading=False;b.ingestion_key=None
