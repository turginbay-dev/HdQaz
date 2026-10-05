"""Button-driven catalog administration through the private backend only."""
import json,uuid
from urllib.parse import urlencode
from .core import SafeError,button,request_key

MENU=[[{'text':'➕ Контент қосу','callback_data':'aadd'},{'text':'🔎 Іздеу','callback_data':'asearch'}],[{'text':'📚 Каталог','callback_data':'acatalog'},{'text':'📋 Кезек','callback_data':'menu_queue'}],[{'text':'⚙️ Басқару','callback_data':'asettings'}]]
FIELDS={'title':'Атауы','description':'Сипаттама','year':'Жылы','country':'Елі','genres':'Жанрлар','duration_minutes':'Ұзақтығы','is_premium':'Premium','dubber_id':'Дыбыстаушы','poster_url':'Постер','banner_url':'Баннер'}
def btn(text,data):return {'text':text,'callback_data':data}
def cid(value):return str(uuid.UUID(value))
def compact(value):return uuid.UUID(value).hex
class AdminFlow:
 def __init__(self,bot):self.b=bot;self.f=bot.movie
 def panel(self,actor,text,buttons=None,mid=None):
  rows=list(buttons or []);rows.append([btn('⬅️ Мәзір','ahome')]);return self.f.panel(actor,text,rows,mid,screen='admin')
 def context(self,actor,kind='movie',section='default'):
  state=self.f.panel_state(actor);state.update(content_kind=kind,content_section=section)
  with self.f.db_lock:self.f.db.execute('insert or replace into panels values(?,?)',(actor,json.dumps(state)));self.f.db.commit()
 def home(self,actor,mid=None):self.panel(actor,'HD Qaz · Басқару',MENU,mid)
 def catalog(self,actor,filter='all',page=0,query='',mid=None):
  if type(page) is not int or page<0:page=0
  result=self.b.api.call('catalog',actor,data={'filter':filter,'page':page,'query':query})
  self.f.save(actor,{'mode':'catalog','filter':filter,'page':page,'query':query})
  lines=['📚 Каталог'+(' · '+query if query else '')];rows=[]
  for c in result['items']:
   title=c['title'].replace('\n',' ')[:48];label=('🎬 ' if c['kind']=='movie' else '📺 ')+title
   lines.append(('✅ ' if c['is_published'] else '✏️ ')+label);rows.append([btn(label,'ci:'+compact(c['id']))])
  if not result['items']:lines.append('Контент табылмады.')
  nav=[]
  if page:nav.append(btn('◀️','cprev'))
  nav.append(btn('🔄 Жаңарту','crefresh'))
  if result.get('has_next'):nav.append(btn('▶️','cnext'))
  rows.append(nav);self.panel(actor,'\n'.join(lines),rows,mid)
 def card(self,actor,id,mid=None):
  c=self.b.api.call('catalog_get',actor,id);self.f.save(actor,{'mode':'catalog_detail','id':id,'expected':c['updated_at']})
  lines=[('🎬 ' if c['kind']=='movie' else '📺 ')+c['title'],'📅 '+str(c.get('year') or '—'),'🌍 '+(c.get('country') or '—'),'🎭 '+', '.join(c.get('genres') or []),'⏱ '+str(c.get('duration_minutes') or '—')+' мин','💎 Premium: '+('Иә' if c['is_premium'] else 'Жоқ'),'🗣 '+(c.get('dubber_name') or 'Таңдалмаған'),'Бөлім: '+{'default':'Қалыпты','anime':'Anime','dorama':'Dorama'}[c['section']],'✅ Жарияланған' if c['is_published'] else '✏️ Жарияланбаған']
  if c['kind']=='series':lines.append('📺 '+str(len(c['seasons']))+' маусым · '+str(len(c['episodes']))+' серия')
  lines.append('🎞 HLS сілтемесі бар · желі тексерілмеді' if c.get('hls_url') or any(e.get('hls_url') for e in c['episodes']) else '🎞 Видео әлі дайын емес')
  if c.get('description'):lines+=['',c['description'][:1100]]
  key=compact(id);rows=[[btn('ℹ️ Ақпарат / Жаңарту','ci:'+key),btn('✏️ Өзгерту','ce:'+key)]]
  if c['kind']=='series':rows.append([btn('➕ Серия қосу','cn:'+key),btn('📋 Сериялар','cl:'+key)])
  for w in c.get('workflows',[]):
   j=w.get('job') or {}
   if w['state'] in ('draft','staging','submitted'):
    rows.append([button(w,'get','🎞 '+({'ready':'Ready','failed':'Қате'}.get(j.get('status'),str(j.get('progress_percent',0))+'%'))+' · Карточка')])
  if c['is_published']:
   rows.append([btn('⛔ Жарияламау','cu:'+key)])
   rows.append([{'text':'▶️ Сайтта көру','url':c['watch_url']}])
   share=c['title']+'\n'+(c.get('description') or '')[:250]+'\n'+c['watch_url']
   rows.append([{'text':'📱 WhatsApp','url':'https://wa.me/?'+urlencode({'text':share})},{'text':'📤 Telegram бөлісу','url':'https://t.me/share/url?'+urlencode({'url':c['watch_url'],'text':c['title']})}])
   rows.append([btn('📤 Telegram арнасына' if c.get('channel_enabled') else '📤 Арна бапталмаған','cp:'+key if c.get('channel_enabled') else 'channeloff')])
  elif c.get('hls_url') or any(e['is_published'] and e.get('hls_url') for e in c['episodes']):rows.append([btn('✅ Жариялау','cv:'+key)])
  self.panel(actor,'\n'.join(lines),rows,mid)
 def start_numbers(self,actor,w,mid=None,season=1,episode=1):
  self.f.save(actor,{'id':w['id'],'mode':'series_number','step':'season_number','suggested_season':season,'suggested_episode':episode,'message_id':mid})
  self.panel(actor,'📺 Маусым нөмірін жазыңыз.',[[btn(str(season),'snum:'+str(season)),btn('❌ Бас тарту','ahome')]],mid)
 def episode(self,actor,id,mid=None,new_season=False):
  c=self.b.api.call('catalog_get',actor,id)
  if c['kind']!='series':raise SafeError('invalid_input')
  self.context(actor,'series',c['section']);uid=self.uid
  w=self.b.api.call('new',actor,data={'kind':'series'},key=request_key(actor,uid,'new'))
  w=self.b.mutate(w,actor,uid,'existing',{'content_id':id})
  season=max([s['season_number'] for s in c['seasons']]+[1]);season=season+1 if new_season else season
  sid=next((s['id'] for s in c['seasons'] if s['season_number']==season),None)
  episode=max([e['episode_number'] for e in c['episodes'] if e['season_id']==sid]+[0])+1
  self.start_numbers(actor,w,mid,season,episode)
 def handle(self,u,actor):
  cb=u.get('callback_query');v=cb.get('data','') if cb else '';v='ak:series' if v=='menu_series' else v;mid=cb['message'].get('message_id') if cb else None;self.uid=u['update_id'];s=self.f.get(actor) or {};text=u.get('message',{}).get('text','').strip()
  known=v in ('ahome','aadd','asearch','acatalog','asettings','channeloff','cprev','cnext','crefresh','series_existing') or v.startswith(('ak:','sec:','cf:','ci:','ce:','cn:','cs:','cl:','cu:','cv:','cp:','field:','save:','pub:','snum:','bool:','dub:'))
  if cb and not known:return False
  if cb:self.b.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']})
  if v=='ahome':self.f.clear(actor);self.home(actor,mid);return True
  if v=='aadd':self.panel(actor,'➕ Контент түрін таңдаңыз.',[[btn('🎬 Фильм','ak:movie'),btn('📺 Сериал','ak:series')]],mid);return True
  if v.startswith('ak:'):
   kind=v[3:]
   if kind not in ('movie','series'):raise SafeError('invalid_input')
   rows=[[btn('🎞 Қалыпты','sec:'+kind+':default'),btn('🇯🇵 Anime','sec:'+kind+':anime'),btn('🇰🇷 Dorama','sec:'+kind+':dorama')]]
   if kind=='series':rows.append([btn('📚 Бар сериал','series_existing')])
   self.panel(actor,'Бөлімді таңдаңыз.',rows,mid);return True
  if v.startswith('sec:'):
   _,kind,section=v.split(':')
   if kind not in ('movie','series') or section not in ('default','anime','dorama'):raise SafeError('invalid_input')
   self.f.clear(actor);self.context(actor,kind,section);self.f.choice(actor,mid);return True
  if v=='series_existing':self.catalog(actor,'series',mid=mid);return True
  if v in ('asettings','channeloff'):
   self.panel(actor,'⚙️ Басқару\nКонтентті Каталог арқылы өзгертіңіз.\nЖариялау тек өз растауыңызбен орындалады.'+('\nTelegram арнасы бапталмаған. Бөлісу батырмасын қолдануға болады.' if v=='channeloff' else ''),[[btn('📚 Каталог','acatalog'),btn('📋 Кезек','menu_queue')]],mid);return True
  if v=='asearch':self.f.save(actor,{'mode':'catalog_search'});self.panel(actor,'🔎 Атауын жазыңыз.',mid=mid);return True
  if v=='acatalog':self.panel(actor,'📚 Каталог',[[btn('🎬 Фильмдер','cf:movie'),btn('📺 Сериалдар','cf:series')],[btn('🇯🇵 Anime','cf:anime'),btn('🇰🇷 Dorama','cf:dorama')],[btn('✅ Жарияланған','cf:published'),btn('✏️ Draft / Ready','cf:draft')],[btn('Барлығы','cf:all')]],mid);return True
  if v.startswith('cf:'):self.catalog(actor,v[3:],mid=mid);return True
  if v in ('cprev','cnext','crefresh'):
   if s.get('mode')!='catalog':raise SafeError('stale')
   page=s.get('page',0);page=page if type(page) is int else 0
   self.catalog(actor,s.get('filter','all'),max(0,page+(1 if v=='cnext' else -1 if v=='cprev' else 0)),s.get('query',''),mid);return True
  if v.startswith(('ci:','cn:','cs:','cl:','ce:','cu:','cv:','cp:')):
   op,id=v.split(':',1);id=cid(id)
   if op=='ci':self.card(actor,id,mid)
   elif op in ('cn','cs'):self.episode(actor,id,mid,op=='cs')
   elif op=='cl':
    c=self.b.api.call('catalog_get',actor,id);seasons={x['id']:x['season_number'] for x in c['seasons']};lines=['📋 '+c['title']]
    for e in c['episodes'][:60]:lines.append(str(seasons.get(e['season_id'],'—'))+' маусым · '+str(e['episode_number'])+' серия '+('✅' if e['is_published'] else '✏️'))
    self.panel(actor,'\n'.join(lines),[[btn('➕ Келесі серия','cn:'+compact(id)),btn('➕ Жаңа маусым','cs:'+compact(id))]],mid)
   elif op=='ce':
    c=self.b.api.call('catalog_get',actor,id);self.f.save(actor,{'mode':'catalog_edit','id':id,'expected':c['updated_at']});self.panel(actor,'✏️ Қай мәліметті өзгертеміз?',[[btn(label,'field:'+compact(id)+':'+key)] for key,label in FIELDS.items()],mid)
   elif op in ('cu','cv'):
    c=self.b.api.call('catalog_get',actor,id);nonce=str(self.uid);self.f.save(actor,{'mode':'catalog_publish','id':id,'expected':c['updated_at'],'action':'catalog_unpublish' if op=='cu' else 'catalog_publish','nonce':nonce})
    self.panel(actor,c['title']+'\n'+('Сайттан жасыруды растайсыз ба?' if op=='cu' else 'Видеоны тексердіңіз бе? Жариялауды растаңыз.'),[[btn('✅ Растау','pub:'+nonce),btn('❌ Бас тарту','ci:'+compact(id))]],mid)
   elif op=='cp':
    result=self.b.api.call('catalog_post',actor,id,key=request_key(actor,self.uid,'catalog_post'));labels={'sent':'✅ Арнаға жіберілген.','pending':'📤 Арна кезегінде.','sending':'📤 Жіберілуде.','uncertain':'Жіберу нәтижесін арнадан тексеріңіз. Қайталау тоқтатылған.','disabled':'Арна бапталмаған.'};self.panel(actor,labels.get(result['status'],'Арна күйін тексеріңіз.'),[[btn('⬅️ Карточка','ci:'+compact(id))]],mid)
   return True
  if v.startswith('field:'):
   _,id,field=v.split(':');id=cid(id)
   if s.get('mode')!='catalog_edit' or s.get('id')!=id or field not in FIELDS:raise SafeError('stale')
   s.update(field=field,mode='catalog_value');self.f.save(actor,s);rows=[]
   if field=='is_premium':rows=[[btn('Иә','bool:yes'),btn('Жоқ','bool:no')]]
   if field=='dubber_id':
    opts=self.b.api.call('admin_options',actor);rows=[[btn(x['name'][:45],'dub:'+compact(x['id']))] for x in opts['dubbers']];rows.append([btn('Таңдаусыз','dub:none')])
   label=FIELDS[field]+': жаңа мәнін жіберіңіз.'
   if field=='genres':label+='\n'+', '.join(x['name'] for x in self.b.api.call('admin_options',actor)['genres'])+'\nҮтірмен бөліңіз.'
   if field in ('poster_url','banner_url'):label+='\nTMDB немесе cdn.hdqaz.online сурет сілтемесі.'
   self.panel(actor,label,rows,mid);return True
  if v.startswith(('save:','pub:')):
   op,nonce=v.split(':')
   if s.get('nonce')!=nonce or s.get('mode')!=('catalog_confirm' if op=='save' else 'catalog_publish'):raise SafeError('stale')
   self.b.api.call('catalog_edit' if op=='save' else s['action'],actor,s['id'],data={'expected':s['expected'],**({'patch':s['patch']} if op=='save' else {})},key=request_key(actor,self.uid,'catalog_'+op));self.card(actor,s['id'],mid);return True
  if s.get('mode')=='series_number' and ((text and not text.startswith('/')) or v.startswith('snum:')):
   try:number=int(v[5:] if v.startswith('snum:') else text)
   except ValueError:raise SafeError('invalid_input')
   if not 1<=number<=10080:raise SafeError('invalid_input')
   w=self.b.api.call('get',actor,s['id']);w=self.b.mutate(w,actor,self.uid,'edit',{**w['metadata'],s['step']:number})
   if s['step']=='season_number':
    s['step']='episode_number';self.f.save(actor,s);self.panel(actor,'🎞 Серия нөмірін жазыңыз.',[[btn(str(s['suggested_episode']),'snum:'+str(s['suggested_episode']))]],mid)
   else:
    self.f.save(actor,{'id':w['id'],'mode':'review','step':0,'last':self.uid,'message_id':mid});self.f.detail(actor,w,mid)
   return True
  if s.get('mode')=='catalog_search' and text and not text.startswith('/'):
   self.catalog(actor,query=text);return True
  if s.get('mode')=='catalog_value' and ((text and not text.startswith('/')) or v.startswith(('bool:','dub:'))):
   field=s['field'];value=text
   if field in ('year','duration_minutes'):
    try:value=int(text)
    except ValueError:raise SafeError('invalid_input')
   if field=='genres':value=[x.strip() for x in text.split(',') if x.strip()]
   if field=='is_premium':
    if v not in ('bool:yes','bool:no'):raise SafeError('invalid_input')
    value=v=='bool:yes'
   if field=='dubber_id':
    if not v.startswith('dub:'):raise SafeError('invalid_input')
    value=None if v=='dub:none' else cid(v[4:])
   s.update(mode='catalog_confirm',patch={field:value},nonce=str(self.uid));self.f.save(actor,s)
   display=('Иә' if value else 'Жоқ') if field=='is_premium' else ('Таңдалды' if value else 'Таңдаусыз') if field=='dubber_id' else str(value)[:1000]
   self.panel(actor,FIELDS[field]+': '+display+'\nСақтаймыз ба?',[[btn('✅ Сақтау','save:'+s['nonce']),btn('❌ Бас тарту','ci:'+compact(s['id']))]],mid);return True
  return False
