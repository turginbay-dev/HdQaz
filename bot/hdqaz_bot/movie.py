"""Durable private movie conversation; existing backend remains workflow authority."""
import json
import sqlite3
import shutil
import threading
import time
import uuid
from pathlib import Path
from .core import SafeError,button,callback,request_key
from .ingestion import stage_local

FIELDS=[('title','🎬 Кино атауын жазыңыз'),('year','📅 Шыққан жылы'),('description','📝 Сипаттама'),('country','🌍 Ел'),('genres','🎭 Жанрлар (үтірмен бөліңіз)'),('duration_minutes','⏱ Ұзақтығы (минут)'),('is_premium','💎 Premium?')]
class MovieFlow:
 def __init__(self,bot):
  self.b=bot;root=Path(bot.c.state_root);root.mkdir(mode=0o700,parents=True,exist_ok=True)
  self.schedule_lock=threading.Lock()
  self.db=sqlite3.connect(root/'conversation.sqlite',check_same_thread=False);self.db_lock=threading.RLock();self.db.execute('pragma journal_mode=WAL');self.db.execute('pragma synchronous=FULL')
  self.db.execute('create table if not exists ingestions(id text primary key,data text not null)');self.db.execute("update ingestions set data=json_set(data,'$.mode','interrupted') where json_extract(data,'$.mode')='ingest'");self.db.execute('create table if not exists sessions(actor integer primary key, data text not null)');self.db.execute('create table if not exists panels(actor integer primary key, data text not null)');self.db.commit()
 def ingestion_rows(self,actor=None):
  with self.db_lock:rows=[json.loads(r[0]) for r in self.db.execute('select data from ingestions')]
  return [r for r in rows if actor is None or r.get('actor')==actor]
 def ingestion_save(self,s):
  with self.db_lock:self.db.execute('insert or replace into ingestions values(?,?)',(s['id'],json.dumps(s)));self.db.commit()
 def ingestion_note(self,s,text,buttons=None):
  # A transfer owns its acknowledgement, never the admin's current menu panel.
  if not s.get('ack_id'):return
  fingerprint=json.dumps([text,buttons or []],ensure_ascii=False)
  if s.get('notice')==fingerprint:return
  try:self.b.tg.call('editMessageText',{'chat_id':s['actor'],'message_id':s['ack_id'],'text':text[:3900],'reply_markup':{'inline_keyboard':buttons or []}})
  except SafeError as e:
   if not e.definite:raise # Keep retries on temporary transport failures; never spam a replacement.
  s['notice']=fingerprint;self.ingestion_save(s)
 def schedule(self):
  if not self.schedule_lock.acquire(blocking=False):return
  try:self._schedule()
  finally:self.schedule_lock.release()
 def _schedule(self):
  for s in self.ingestion_rows():
   if s.get('mode')!='pending' or self.b.ingestion_active(s['actor'],s['file_id'],s['id']):continue
   if self.b.ingestion_count()>=2:break
   try:
    s['mode']='ingest';self.ingestion_save(s)
    if not self.b.start_ingestion(self._ingest_background,s['actor'],s['update'],s.copy(),s['file_size'],s['file_id'],s['source_ref'],identity=(s['actor'],s['id'],s['file_id']),reserve=s['file_size']*3):
     s['mode']='pending';self.ingestion_save(s)
   except SafeError:
    s['mode']='pending';self.ingestion_save(s)
    try:self.ingestion_note(s,'✅ Видео қабылданды\nКезекте. Бос орын ашылғанда қабылдау жалғасады.')
    except SafeError:pass
 def run_ingestions(self):
  # Only the process holding the existing backend runtime lease starts this loop.
  for s in self.ingestion_rows():
   if s.get('mode')=='awaiting_ack' or (s.get('mode')=='interrupted' and not s.get('error') and s.get('ack_id')):
    s['mode']='pending';self.ingestion_save(s)
  while not self.b.stop.wait(3):
   try:
    self.b.guard();self.schedule()
    for s in self.ingestion_rows():
     if s.get('mode')!='done' or not s.get('ack_id') or s.get('terminal') or time.time()-s.get('polled',0)<30:continue
     try:self.update_ingestion_status(s)
     except Exception:
      s['polled']=time.time();self.ingestion_save(s)
   except Exception:print('{"event":"ingestion_queue_retry"}',flush=True)
 def update_ingestion_status(self,s):
  w=self.b.api.call('get',s['actor'],s['id']);j=w.get('job') or {};status=j.get('status')
  s['polled']=time.time()
  label={'queued':'⬇️ Кезекте','downloading':'⬇️ Қабылдау','processing':'⚙️ Өңделуде','uploading':'☁️ Жүктелуде','ready':'✅ Ready','failed':'❌ Өңдеу аяқталмады'}.get(status,'⬇️ Кезекте')
  self.ingestion_note(s,s.get('title','Видео')+'\n'+label+' — '+str(j.get('progress_percent',0))+'%',[[button(w,'get','📋 Карточка')]])
  s['terminal']=status in ('ready','failed') or w['state'] in ('published','rejected');self.ingestion_save(s)
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
 def panel(self,actor,text,buttons=None,message_id=None,screen=None,page=None,workflow=None,confirmed=None,fresh=False):
  state=self.panel_state(actor);message_id=None if fresh else message_id or state.get('message_id')
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
 def context(self,actor):
  p=self.panel_state(actor);return {'kind':p.get('content_kind','movie'),'section':p.get('content_section','default')}
 def new_movie(self,actor,uid,message_id,kind=None):
  w=self.b.api.call('new',actor,data={**self.context(actor),**({'kind':kind} if kind else {})},key=request_key(actor,uid,'new'))
  self.save(actor,{'id':w['id'],'mode':'manual','step':0,'last':uid,'message_id':message_id})
  self.prompt(actor,self.get(actor));return w
 def choice(self,actor,message_id):
  return self.panel(actor,('🎬 Киноны' if self.context(actor)['kind']=='movie' else '📺 Сериалды')+' қалай қосамыз?',[[{'text':'🔎 TMDB арқылы табу','callback_data':'movie_tmdb'},{'text':'✍️ Қолмен енгізу','callback_data':'movie_manual'}]],message_id,'movie_choice',workflow=None,confirmed=False)
 def queue(self,actor,page=0,message_id=None,drafts=False):
  rows=self.b.api.call('drafts' if drafts else 'queue',actor)
  rows=[w for w in rows if isinstance(w,dict) and w.get('state') not in ('published','rejected') and (drafts or (w.get('job') and not w['job'].get('admin_hidden_at'))) and isinstance(w.get('id'),str) and type(w.get('revision')) is int]
  known={w['id'] for w in rows}
  for r in self.ingestion_rows(actor):
   if not drafts and r.get('mode') in ('pending','ingest','interrupted') and r['id'] not in known:
    rows.insert(0,{'id':r['id'],'revision':0,'kind':r.get('kind','movie'),'state':'ingesting','metadata':r.get('metadata',{}),'job':{'status':'receiving','progress_percent':0}})
  if type(page) is not int or page<0:page=0
  size=5;pages=max(1,(len(rows)+size-1)//size);page=max(0,min(page,pages-1));items=rows[page*size:(page+1)*size]
  lines=['✏️ Видео күткендер' if drafts else '📋 Кезек'];buttons=[]
  if not items:lines.append('Кезек бос.')
  for i,w in enumerate(items,page*size+1):
   m=w.get('metadata') if isinstance(w.get('metadata'),dict) else {};j=w.get('job') if isinstance(w.get('job'),dict) else {};status={'draft':'🎞 Видео күтілуде','staging':'⬇️ Қабылдау','rejected':'❌ Қабылданбады'}.get(w.get('state'),'⬇️ Кезекте')
   if j:status={'queued':'⬇️ '+str(j.get('progress_percent',0))+'%','processing':'⚙️ '+str(j.get('progress_percent',0))+'%','uploading':'☁️ '+str(j.get('progress_percent',0))+'%','ready':'✅ Ready','failed':'❌ Failed','receiving':'⬇️ Қабылдануда'}.get(j.get('status'),status)
   title=str(m.get('title') or 'Жаңа кино').replace('\n',' ')[:36]
   episode=(' · '+str(m.get('season_number','—'))+'×'+str(m.get('episode_number','—'))) if w.get('kind')=='series' else '';lines.append(f'{i}. 🎬 {title}{episode} — {status}')
   buttons.append([{'text':f'{i}. {title[:40]}','callback_data':'qrow:'+w['id'].replace('-','')+':'+str(w['revision'])}])
  nav=[]
  if page:nav.append({'text':'◀️','callback_data':'dprev' if drafts else 'qprev'})
  nav.append({'text':'🔄 Жаңарту','callback_data':'drefresh' if drafts else 'qrefresh'})
  if page<pages-1:nav.append({'text':'▶️','callback_data':'dnext' if drafts else 'qnext'})
  buttons.append(nav);buttons.append([{'text':'⬅️ Мәзір','callback_data':'ahome'}]);self.panel(actor,'\n'.join(lines),buttons,message_id,'drafts' if drafts else 'queue',page)
 def open_row(self,actor,wid,revision,message_id):
  r=next((r for r in self.ingestion_rows(actor) if r['id']==wid and r.get('mode') in ('pending','ingest','interrupted')),None)
  if r:
   buttons=[[{'text':'⛔ Қабылдауды тоқтату','callback_data':'ingcancel:'+uuid.UUID(wid).hex}],[{'text':'📋 Кезек','callback_data':'qback'}]]
   if r.get('mode')=='interrupted':buttons.insert(0,[{'text':'🔄 Қайталау','callback_data':'ingretry:'+uuid.UUID(wid).hex}])
   self.panel(actor,r.get('title','Видео')+'\n⬇️ Қабылдануда' if not r.get('error') else 'Қабылдау аяқталмады. Қайталап көріңіз.',buttons,message_id,'detail',workflow=wid);return
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
  if cb and value.startswith(('ingretry:','ingcancel:','ingstop:')):
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});op,key=value.split(':');wid=str(uuid.UUID(hex=key))
   r=next((r for r in self.ingestion_rows(actor) if r['id']==wid),None)
   if not r:raise SafeError('stale')
   if op=='ingretry':
    if r.get('mode')!='interrupted':raise SafeError('stale')
    r.update(mode='pending',error=None);self.ingestion_save(r);self.schedule();self.queue(actor,0,cb['message']['message_id']);return True
   if op=='ingcancel':
    self.panel(actor,'Осы видеоны қабылдауды тоқтатамыз ба?',[[{'text':'Иә, тоқтату','callback_data':'ingstop:'+key},{'text':'Жоқ, қалсын','callback_data':'qback'}]],cb['message']['message_id']);return True
   # Fence the transfer first, then cancel only its exact backend job/workflow.
   (b.c.root/('.cleanup-'+wid)).touch(mode=0o600)
   r.update(mode='cancelled');self.ingestion_save(r)
   w=b.api.call('get',actor,wid);b.mutate(w,actor,uid,'discard')
   self.ingestion_note(r,'⛔ Қабылдау тоқтатылды.',[[{'text':'📋 Кезек','callback_data':'menu_queue'}]])
   current=self.get(actor)
   if current and current.get('id')==wid:self.clear(actor)
   self.queue(actor,0,cb['message']['message_id']);return True
  if cb and value=='menu_movie':
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});self.clear(actor);self.b.admin.context(actor);self.choice(actor,cb['message']['message_id']);return True
  if cb and value=='menu_drafts':
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});self.queue(actor,0,cb['message']['message_id'],True);return True
  if cb and value in ('drefresh','dprev','dnext'):
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});page=self.panel_state(actor).get('page',0);page=(page if type(page) is int else 0)+(1 if value=='dnext' else -1 if value=='dprev' else 0);self.queue(actor,page,cb['message']['message_id'],True);return True
  if cb and value=='menu_queue':
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});self.queue(actor,0,cb['message']['message_id']);return True
  if cb and value in ('qrefresh','qprev','qnext'):
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});state=self.panel_state(actor);page=state.get('page',0);page=(page if type(page) is int else 0)+(1 if value=='qnext' else -1 if value=='qprev' else 0);self.queue(actor,page,cb['message']['message_id']);return True
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
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});tmdb=int(value.split(':',1)[1]);w=b.api.call('new',actor,data=self.context(actor),key=request_key(actor,u['update_id'],'new'));w=b.api.call('select',actor,w['id'],w['revision'],{'tmdb_id':tmdb},request_key(actor,u['update_id'],'select'));self.save(actor,{'id':w['id'],'mode':'review','step':0,'last':u['update_id'],'message_id':cb['message']['message_id']});self.panel(actor,'✅ Кино таңдалды. Мәліметтерді қарап шығыңыз.',[[button(w,'confirm','✅ Дұрыс'),button(w,'manual','✏️ Өзгерту')],[button(w,'cancel','❌ Бас тарту')]],cb['message']['message_id'],'movie_review',workflow=w['id'],confirmed=False);self.detail(actor,w,cb['message']['message_id']);return True
  if cb and value=='mcard':
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']});state=self.get(actor);w=b.api.call('get',actor,state['id']);self.detail(actor,w,cb['message']['message_id']);return True
  if cb and value in ('menu_series',):self.clear(actor);return False
  if cb and not premium:
   try:wid,rev,action=callback(value)
   except SafeError:return False
   if action not in ('manual','video','cancel','confirm','get','publish','reject','retry','discard','discardask'):return False
   w=b.api.call('get',actor,wid)
   if w['kind'] not in ('movie','series'):return False
   b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']})
   if w['revision']!=rev:raise SafeError('stale')
   if action in ('cancel','manual','video','confirm') and w['state']!='draft':raise SafeError('stale')
   if action=='cancel':
    b.mutate(w,actor,uid,'discard');self.clear(actor);self.panel(actor,'Draft жойылды.',[[{'text':'🎬 Жаңа кино','callback_data':'menu_movie'},{'text':'📋 Кезек','callback_data':'menu_queue'}]],cb['message']['message_id'],'home');return True
   if action=='manual':
    s={'id':wid,'mode':'manual','step':0,'last':uid,'message_id':cb['message']['message_id']};self.save(actor,s);self.prompt(actor,s);return True
   if action in ('confirm','video') and w['kind']=='series' and (not w['metadata'].get('season_number') or not w['metadata'].get('episode_number')):
    b.admin.start_numbers(actor,w,cb['message']['message_id']);return True
   if action=='confirm':
    self.panel_state(actor);self.panel(actor,'🎞 Енді кино файлын жіберіңіз немесе forward жасаңыз.',[[{'text':'🔙 Карточка','callback_data':'mcard'}]],cb['message']['message_id'],'movie_video',workflow=wid,confirmed=True);self.save(actor,{'id':wid,'mode':'video','step':0,'last':uid,'message_id':cb['message']['message_id'],'confirmed':True,'metadata':w['metadata'],'kind':w['kind']});return True
   if action=='video' and (not w['metadata'].get('title') or not w['metadata'].get('year')):raise SafeError('metadata_required')
   if action=='video':
    s={'id':wid,'mode':'video','step':0,'last':uid,'message_id':cb['message']['message_id'],'confirmed':True,'metadata':w['metadata'],'kind':w['kind']};self.save(actor,s);self.prompt(actor,s);return True
   if action=='discardask':
    self.panel(actor,'Тек осы тапсырманы кезектен алып тастаймыз ба? Контент беті сақталады.',[[button(w,'discard','Иә, алып тастау'),button(w,'get','Жоқ, қалсын')]],cb['message']['message_id']);return True
   if action in ('get','publish','reject','retry','discard'):
    if action!='get':w=b.mutate(w,actor,uid,action)
    if action=='discard':self.queue(actor,0,cb['message']['message_id']);return True
    w=b.api.call('get',actor,wid);self.detail(actor,w,cb['message']['message_id']);return True
  message=u.get('message',{});media=message.get('video') or message.get('document')
  if media:
   prior=next((r for r in self.ingestion_rows(actor) if r.get('update')==uid),None)
   if prior:return True
   if not s and any(r.get('file_unique_id')==(media.get('file_unique_id') or media.get('file_id')) for r in self.ingestion_rows(actor)):
    b.tg.send(actor,'Бұл видео қабылданған. Тапсырманы кезектен тексеріңіз.',[[{'text':'📋 Кезек','callback_data':'menu_queue'},{'text':'❌ Бас тарту','callback_data':'ahome'}]]);return True
   if not s or s['mode'] not in ('video','ingest') or not s.get('confirmed'):
    b.tg.send(actor,'Алдымен Movie мәліметтерін толтырып, 🎞 Видео қосу түймесін басыңыз.');return True
   return self.ingest(actor,u,s,media)
  if not s:return False
  text=message.get('text','').strip()
  if s['mode']=='tmdb_query' and text and not text.startswith('/'):
   try:results=b.api.call('search',actor,data={'kind':self.context(actor)['kind'],'query':text})
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
   self.panel(actor,'✅ Мәліметтер дайын. Кино карточкасын қарап шығыңыз.',[[button(w,'confirm','✅ Дұрыс'),button(w,'manual','✏️ Өзгерту')],[button(w,'cancel','❌ Бас тарту')]],s.get('message_id'),'movie_review',workflow=w['id'],confirmed=False);self.detail(actor,w,s.get('message_id'))
  else:self.save(actor,s);self.prompt(actor,s)
  return True
 def ingest(self,actor,u,s,media):
  b=self.b;uid=u['update_id']
  if b.c.telegram_base!='http://telegram-api:8081':raise SafeError('local_api_required')
  size=media.get('file_size');file_id=media.get('file_id')
  if type(size) is not int or not 0<size<=b.c.max_source or not isinstance(file_id,str) or not 1<=len(file_id)<=1024:raise SafeError('invalid_source')
  mime=media.get('mime_type','')
  if mime not in ('video/mp4','video/quicktime','video/x-matroska','video/webm','application/octet-stream'):raise SafeError('invalid_media')
  previous=next((r for r in self.ingestion_rows(actor) if r['id']==s['id']),None)
  if previous:
   if previous.get('update')==uid:return True
   if previous.get('mode')=='interrupted' and previous['file_id']==file_id:
    previous.update(mode='pending',error=None);self.ingestion_save(previous);self.schedule();return True
   b.tg.send(actor,'Бұл контентке видео қабылданған. Алдыңғы тапсырманы кезектен тексеріңіз.',[[{'text':'📋 Кезек','callback_data':'menu_queue'},{'text':'🗑 Алдыңғысын алып тастау','callback_data':'ingcancel:'+uuid.UUID(previous['id']).hex}],[{'text':'❌ Бас тарту','callback_data':'ahome'}]]);return True
  if len([r for r in self.ingestion_rows() if r.get('mode') in ('pending','ingest','awaiting_ack')])>=100:raise SafeError('upload_busy')
  # Persist before expensive backend/download work; getUpdates may safely be acknowledged.
  identity=media.get('file_unique_id') or file_id
  ref=str(uuid.uuid5(uuid.NAMESPACE_URL,f'hdqaz-telegram:{actor}:{s["id"]}:{identity}'))
  s={**s,'actor':actor,'mode':'awaiting_ack','update':uid,'file_id':file_id,'file_unique_id':identity,'source_ref':ref,'file_size':size}
  self.ingestion_save(s)
  rows=[[{'text':'📋 Кезек','callback_data':'menu_queue'},{'text':'➕ Контент қосу','callback_data':'aadd'}]]
  content=s.get('metadata',{}).get('existing_content_id')
  if s.get('kind')=='series' and content:rows.insert(0,[{'text':'➕ Келесі серия','callback_data':'cn:'+uuid.UUID(content).hex+':'+str(s.get('metadata',{}).get('season_number') or 1)},{'text':'📋 Сериялар','callback_data':'cl:'+uuid.UUID(content).hex}])
  result=b.tg.send(actor,'✅ Видео қабылданды\nКезекке қосылуда…',rows)
  s.update(ack_id=result['message_id'],mode='pending');self.ingestion_save(s)
  self.clear(actor)
  self.schedule()
  return True
 def _ingest_background(self,actor,uid,s,size,file_id,ref):
  b=self.b;started=time.monotonic();finished=False
  def check():
   b.guard()
   marker=b.c.root/('.cleanup-'+s['id'])
   if marker.exists() or marker.is_symlink():raise SafeError('stale')
  def timed(stage,operation):
   before=time.monotonic()
   try:return operation()
   finally:print(json.dumps({'event':'ingest_timing','stage':stage,'seconds':round(time.monotonic()-before,2)}),flush=True)
  try:
   check();w=b.api.call('get',actor,s['id'])
   s.update(title=w.get('metadata',{}).get('title','Видео'),metadata=w.get('metadata',{}),kind=w['kind']);self.ingestion_save(s)
   if w['state']=='submitted' and w.get('source_ref')==ref:
    finished=True;return
   if w['state'] not in ('draft','staging'):raise SafeError('stale')
   if not w['metadata'].get('title') or not w['metadata'].get('year'):raise SafeError('metadata_required')
   if w['state']=='draft':
    try:b.sources.source(ref)
    except (OSError,SafeError):
     s['phase']='downloading';self.ingestion_save(s)
     file=timed('local_api_file',lambda:b.tg.call('getFile',{'file_id':file_id},timeout=3600));check()
     if file.get('file_size')!=size:raise SafeError('source_changed')
     s['cache_path']=str(Path(file['file_path']).relative_to(b.c.telegram_root))
     with self.db_lock:self.db.execute('insert or replace into ingestions values(?,?)',(s['id'],json.dumps({**s,'actor':actor})));self.db.commit()
     timed('source_ingest_copy',lambda:stage_local(b.c.telegram_root,file['file_path'],b.c.root/'inbox',ref,size,b.c.max_source,check=check))
    s['phase']='source_ready';self.ingestion_save(s)
    check()
    if w.get('source_ref')!=ref:w=b.mutate(w,actor,uid,'source',{'source_ref':ref})
    check()
    w=b.mutate(w,actor,uid,'prepare',{'source_ref':ref})
   if w.get('source_ref')!=ref:raise SafeError('source_conflict')
   s.update(job_id=w['job_id'],phase='job_created');self.ingestion_save(s)
   check();b.sources.stage(ref,w['job_id']);check();w=b.mutate(w,actor,uid,'activate')
   finished=True;s['phase']='queued'
   self.ingestion_note(s,s.get('title','Видео')+'\n⬇️ Кезекте',[[button(w,'get','📋 Карточка'),{'text':'📋 Кезек','callback_data':'menu_queue'}]]+([[{'text':'➕ Келесі серия','callback_data':'cn:'+w['content_id'].replace('-','')+':'+str(w['metadata'].get('season_number') or 1)},{'text':'📋 Сериялар','callback_data':'cl:'+w['content_id'].replace('-','')}]] if w['kind']=='series' and w.get('content_id') else []))
  except (SafeError,OSError,KeyError,ValueError) as exc:
   s.update(mode='video',error=getattr(exc,'code','source_io'))
   current=self.get(actor)
   if current and current.get('id')==s['id']:self.save(actor,s)
   errors={'storage_full':'Серверде бос орын жеткіліксіз. Файлды өңдеуге жібермедім.', 'invalid_media':'MP4, MOV, MKV немесе WebM видео жіберіңіз.', 'invalid_source':'Файлдың көлемі не түрі жарамсыз.', 'download_timeout':'Жүктеу уақыты аяқталды. Сол видеоны қайта жіберіңіз.', 'source_io':'Файл қабылданбады. Сол видеоны қайта жіберіңіз.'}
   try:
    if (b.c.root/('.cleanup-'+s['id'])).exists():return
    self.ingestion_note(s,errors.get(getattr(exc,'code',''),'Файл қабылданбады. Қайта жіберіп көріңіз.'),[[{'text':'🔄 Қайталау','callback_data':'ingretry:'+uuid.UUID(s['id']).hex},{'text':'📋 Кезек','callback_data':'menu_queue'}]])
   except Exception:pass
  except Exception:
   s.update(mode='video',error='source_io')
   current=self.get(actor)
   if current and current.get('id')==s['id']:self.save(actor,s)
   try:self.ingestion_note(s,'Файлды қабылдау аяқталмады. Қайталап көріңіз.',[[{'text':'🔄 Қайталау','callback_data':'ingretry:'+uuid.UUID(s['id']).hex},{'text':'📋 Кезек','callback_data':'menu_queue'}]])
   except Exception:pass
   print('{"event":"movie_ingestion_failed"}',flush=True)
  finally:
   print(json.dumps({'event':'ingest_timing','stage':'total','seconds':round(time.monotonic()-started,2)}),flush=True)
   cancelled=(b.c.root/('.cleanup-'+s['id'])).exists()
   s.update(actor=actor,mode='cancelled' if cancelled else 'done' if finished else 'interrupted');self.ingestion_save(s)
