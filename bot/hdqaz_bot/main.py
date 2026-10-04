import json
import os
import signal
import threading
import time
import uuid
from .movie import MovieFlow
from .core import Backend,Config,SafeError,Sources,Telegram,authorized,button,callback,request_key

MENU=[[{'text':'🎬 Movie','callback_data':'menu_movie'},{'text':'📺 Series','callback_data':'menu_series'}],[{'text':'📋 Queue / Status','callback_data':'menu_queue'}]]
class Bot:
    def __init__(self,c,backend=None,telegram=None,sources=None):
        self.c=c;self.api=backend or Backend(c);self.tg=telegram or Telegram(c);self.sources=sources or Sources(c)
        self.movie=MovieFlow(self) if hasattr(c,'state_root') else None
        self.downloading=False
        self.owner=str(uuid.uuid4());self.stop=threading.Event();self.last_success=time.monotonic();self.lease_deadline=None
    def show(self,actor,w):
        if w['kind']=='movie' and self.movie:
            self.show_movie(actor,w);return
        m=w['metadata'];j=w.get('job');text=m.get('title','Жаңа '+w['kind'])+'\n'+str(m.get('year',''))+'\n'+m.get('description','')[:900]
        text+='\nКүй: '+w['state']
        text+='\nЕлі: '+m.get('country','—')+' · Ұзақтығы: '+str(m.get('duration_minutes') or '—')
        text+='\nЖанрлар: '+', '.join(m.get('genres',[]))
        if w.get('source_ref'):text+='\n✅ Видео қабылданды'
        if w['kind']=='series':text+='\nМаусым / серия: '+str(m.get('season_number','—'))+' / '+str(m.get('episode_number','—'))
        text+='\nPremium: '+str(m.get('is_premium',False))+'\nДыбыстаушы: '+str(m.get('dubber_id','—'))
        buttons=[]
        if j:
            text+='\n'+{'queued':'⬇️ Кезекте','processing':'⚙️ Өңделуде','uploading':'☁️ CDN-ге жүктелуде','ready':'✅ Дайын','failed':'❌ Қате'}.get(j['status'],j['status'])+' '+str(j['progress_percent'])+'% · '+str(j['attempt_count'])+'/'+str(j['max_attempts'])
            if j.get('error_code'):text+='\nҚате: '+j['error_code']
            if j['status']=='ready' and w['state']=='submitted':
                text+='\nТексеру: '+j['output_manifest_url']+'\nЖариялау тек төмендегі нақты растаудан кейін орындалады.'
                buttons.append([{'text':'▶️ Тексеру','url':j['output_manifest_url']}])
                buttons.append([button(w,'publish','✅ Тексердім — жариялау'),button(w,'reject','❌ Қабылдамау')])
            if j['status']=='failed' and j['attempt_count']<j['max_attempts'] and w['state']=='submitted':buttons.append([button(w,'retry','Қайта орындау')])
        if w['state']=='draft' and self.movie and w['kind']=='movie':
            buttons.append([button(w,'manual','✏️ Өзгерту'),button(w,'video','🎞 Видео қосу')])
            buttons.append([button(w,'cancel','❌ Бас тарту')])
            text+='\nМәліметтерді қарап, Видео қосу түймесін басыңыз.'
            if w.get('source_ref'):buttons.append([button(w,'prepare','Өңдеуге жіберуді растау')])
        elif w['state']=='draft':
            text+='\n/edit title=Қазақша атауы\n/edit description=Мәтін\n/edit year=2026\n/edit is_premium=false\n/dubbers → /edit dubber_id=UUID'
            if w['kind']=='series':text+='\n/edit season_number=1\n/edit episode_number=1\n/edit episode_title=Атауы'
            text+='\n/edit country=Қазақстан\n/edit duration_minutes=90\n/edit genres=Драма\n/source UUID — серверге алдын ала қойылған файл'
            if w.get('source_ref'):buttons.append([button(w,'prepare','Өңдеуге жіберуді растау')])
        if w['state']=='staging':buttons.append([button(w,'activate','Source handoff жалғастыру')])
        if w['state']=='published':buttons.append([button(w,'postretry','Арна постын қайта жіберу (қате болса)')])
        buttons.append([button(w,'get','Жаңарту'),{'text':'📋 Queue','callback_data':'menu_queue'}])
        self.tg.send(actor,text,buttons)
    def show_movie(self,actor,w):
        m=w['metadata'];j=w.get('job');state=w['state']
        text='🎬 '+m.get('title','Жаңа кино')
        if m.get('year'):text+='\n📅 '+str(m['year'])
        if m.get('country'):text+='\n🌍 '+m['country']
        if m.get('genres'):text+='\n🎭 '+', '.join(m['genres'])
        if m.get('duration_minutes'):text+='\n⏱ '+str(m['duration_minutes'])+' мин'
        text+='\n💎 Premium: '+('Иә' if m.get('is_premium',False) else 'Жоқ')
        if m.get('dubber_id'):text+='\n🎙 Дыбыстаушы таңдалған'
        if m.get('description'):text+='\n\n'+m['description'][:900]
        buttons=[]
        if state=='draft':
            buttons=[[button(w,'manual','✏️ Өзгерту'),button(w,'video','🎞 Видео қосу')],[button(w,'cancel','❌ Бас тарту')]]
            if w.get('source_ref'):buttons.append([button(w,'prepare','Өңдеуге жіберуді растау')])
        elif state=='staging':buttons=[[button(w,'activate','Қабылдауды жалғастыру')]]
        elif state=='published':
            text+='\n\n✅ Жарияланды'
            buttons=[[{'text':'▶️ Сайтта көру','url':'https://hdqaz.online/tg-'+w['id']}]]
        elif state=='rejected':text+='\n\n❌ Қабылданбады'
        if j and state not in ('published','rejected'):
            label={'queued':'⬇️ Кезекте','processing':'⚙️ Өңделуде','uploading':'☁️ CDN-ге жүктелуде','ready':'✅ Дайын','failed':'❌ Өңдеу аяқталмады'}.get(j['status'],'⚙️ Өңделуде')
            text+='\n\n'+label+' — '+str(j['progress_percent'])+'%'
            if j['status']=='ready' and state=='submitted':
                buttons=[[{'text':'▶️ Тексеру','url':j['output_manifest_url']}],[button(w,'publish','✅ Тексердім — жариялау'),button(w,'reject','❌ Қабылдамау')]]
            elif j['status']=='failed' and state=='submitted' and j['attempt_count']<j['max_attempts']:
                buttons=[[button(w,'retry','Қайта орындау')]]
        buttons.append([button(w,'get','🔄 Жаңарту'),{'text':'📋 Кезек','callback_data':'menu_queue'}])
        self.tg.send(actor,text,buttons)
    def current(self,actor):
        rows=self.api.call('queue',actor)
        if not rows:raise SafeError('start_required')
        return rows[0]
    def guard(self):
        if self.stop.is_set() or (self.lease_deadline is not None and time.monotonic()>=self.lease_deadline):raise SafeError('lease_lost')
    def keep_lease(self):
        while not self.stop.wait(20):
            try:
                self.api.call('runtime',data={'owner':self.owner})
                self.lease_deadline=time.monotonic()+60
                if self.downloading:PathHealth.touch()
            except Exception:
                if self.lease_deadline is not None and time.monotonic()>=self.lease_deadline:self.stop.set()
    def mutate(self,w,actor,update,action,data=None):
        self.guard()
        return self.api.call(action,actor,w['id'],w['revision'],data,request_key(actor,update,action))
    def handle(self,u):
        self.guard()
        actor=authorized(u,self.c.admins)
        if actor is None:return
        if self.movie and self.movie.handle(u,actor):return
        cb=u.get('callback_query');uid=u['update_id']
        if cb:
            self.tg.call('answerCallbackQuery',{'callback_query_id':cb['id']})
            value=cb.get('data','')
            if value in ('menu_movie','menu_series'):
                w=self.api.call('new',actor,data={'kind':value[5:]},key=request_key(actor,uid,'new'))
                self.tg.send(actor,'Атауын жазып TMDB іздеңіз немесе қолмен енгізуді таңдаңыз.',[[button(w,'manual','✍️ Қолмен енгізу / Manual entry')]]);return
            if value=='menu_queue':
                rows=self.api.call('queue',actor)
                if not rows:self.tg.send(actor,'Кезек бос.',MENU);return
                for w in rows[:8]:self.show(actor,w)
                return
            wid,revision,action=callback(value);w=self.api.call('get',actor,wid)
            if w['revision']!=revision:raise SafeError('stale')
            if action=='manual':
                self.show(actor,w);return
            if action.startswith('tmdb'):
                w=self.mutate(w,actor,uid,'select',{'tmdb_id':int(action[4:])})
            elif action=='prepare':
                self.sources.source(w['source_ref'])
                w=self.mutate(w,actor,uid,'prepare',{'source_ref':w['source_ref']})
                self.sources.stage(w['source_ref'],w['job_id'])
                w=self.mutate(w,actor,uid,'activate')
            elif action=='activate':
                self.sources.stage(w['source_ref'],w['job_id']);w=self.mutate(w,actor,uid,'activate')
            elif action in ('publish','reject','retry','postretry'):w=self.mutate(w,actor,uid,'post_retry' if action=='postretry' else action)
            elif action!='get':raise SafeError('invalid_input')
            self.show(actor,self.api.call('get',actor,w['id']));return
        text=u['message'].get('text','').strip()
        if text in ('/start','/menu'):self.tg.send(actor,'HD Qaz · Private Admin',MENU);return
        if text=='/queue':
            for w in self.api.call('queue',actor)[:8]:self.show(actor,w)
            return
        if text=='/dubbers':self.tg.send(actor,'\n'.join(x['name']+' · '+x['id'] for x in self.api.call('dubbers',actor)));return
        w=self.current(actor)
        if text.startswith('/existing '):
            rows=self.api.call('titles',actor,data={'query':text[10:]})
            self.tg.send(actor,'\n'.join(x['title']+' ('+str(x['year'])+')\n/use '+x['id'] for x in rows) or 'Табылмады.');return
        if text.startswith('/use '):w=self.mutate(w,actor,uid,'existing',{'content_id':text[5:].strip()})
        elif text.startswith('/source '):
            ref=str(uuid.UUID(text[8:].strip()));self.sources.source(ref);w=self.mutate(w,actor,uid,'source',{'source_ref':ref})
        elif text.startswith('/edit '):
            field,sep,value=text[6:].partition('=')
            if not sep or field not in {'title','description','year','is_premium','dubber_id','season_number','episode_number','episode_title','episode_description','country','duration_minutes','genres','poster_url','banner_url'}:raise SafeError('invalid_input')
            if field in ('year','season_number','episode_number','duration_minutes'):value=int(value)
            elif field=='genres':value=[x.strip() for x in value.split(',') if x.strip()]
            elif field=='is_premium':
                if value not in ('true','false'):raise SafeError('invalid_input')
                value=value=='true'
            m={**w['metadata'],field:value};w=self.mutate(w,actor,uid,'edit',m)
        elif text and not text.startswith('/'):
            try:rows=self.api.call('search',actor,data={'kind':w['kind'],'query':text})
            except SafeError:
                self.tg.send(actor,'TMDB әзірге қолжетімсіз. Қолмен енгізуге болады.',[[button(w,'manual','✍️ Қолмен енгізу / Manual entry')]]);return
            self.tg.send(actor,'TMDB: дұрыс нәтижені таңдаңыз.',[[button(w,'tmdb'+str(x['tmdb_id']),x['title'][:60]+' · '+str(x.get('year') or '—'))] for x in rows]);return
        else:raise SafeError('invalid_input')
        self.show(actor,w)
    def post(self):
        token=str(uuid.uuid4())
        try:r=self.api.call('post_claim',data={'token':token})
        except SafeError:return
        if not r or r['status']!='sending':return
        if r.get('mode')=='test':
            chat=self.tg.call('getChat',{'chat_id':r['channel_id']})
            if chat.get('username') or chat.get('type')!='channel':
                self.api.call('post_result',id=r['id'],data={'token':token,'status':'failed'})
                return
        p={'chat_id':r['channel_id'],'reply_markup':{'inline_keyboard':[[{'text':'▶ Көру','url':r['watch_url']}]]}}
        caption=r['title'][:700]+' · '+str(r['year'])
        if r.get('poster_url'):method='sendPhoto';p.update(photo=r['poster_url'],caption=caption)
        else:method='sendMessage';p['text']=caption
        try:
            self.guard();sent=self.tg.call(method,p);status='sent';message=sent['message_id']
        except SafeError as e:status='failed' if e.definite else 'uncertain';message=None
        # A lost acknowledgement leaves sending -> uncertain; it never triggers another send.
        self.api.call('post_result',id=r['id'],data={'token':token,'status':status,'message_id':message})
    def run(self):
        offset=None;backoff=1;next_post=0;keeper=None
        while not self.stop.is_set():
            try:
                state=self.api.call('runtime',data={'owner':self.owner,**({'offset':offset} if offset is not None else {})})
                offset=state['offset'];self.lease_deadline=time.monotonic()+60
                if keeper is None:
                    keeper=threading.Thread(target=self.keep_lease,daemon=True);keeper.start()
                updates=self.tg.call('getUpdates',{'offset':offset,'timeout':20,'limit':1,'allowed_updates':['message','callback_query']},timeout=30)
                for u in updates:
                    try:self.handle(u)
                    except (SafeError,ValueError,KeyError,OSError) as exc:
                        actor=authorized(u,self.c.admins)
                        if actor:
                            errors={'storage_full':'Серверде видеоға жеткілікті бос орын жоқ. Файл өңдеуге жіберілген жоқ.', 'invalid_media':'MP4, MOV, MKV немесе WebM видео файлын жіберіңіз.', 'invalid_source':'Файл көлемі немесе түрі жарамсыз.', 'download_timeout':'Жүктеу уақыты аяқталды. Сол файлды қайта жіберуге болады.', 'source_io':'Файл қабылдау аяқталмады. Сол файлды қайта жіберіңіз.'}
                            self.tg.send(actor,errors.get(getattr(exc,'code',''),'Әрекет орындалмады немесе күйі өзгерді. /queue арқылы тексеріп, жаңартыңыз.'))
                    offset=u['update_id']+1
                    self.api.call('runtime',data={'owner':self.owner,'offset':offset})
                self.last_success=time.monotonic();PathHealth.touch();backoff=1
                if time.monotonic()>=next_post:self.post();next_post=time.monotonic()+60
            except Exception:
                print(json.dumps({'event':'bot_temporarily_unavailable'}),flush=True)
                if time.monotonic()-self.last_success>180:raise SafeError('recovery_restart') from None
                self.stop.wait(backoff);backoff=min(30,backoff*2)
class PathHealth:
    @staticmethod
    def touch():
        from pathlib import Path
        Path('/tmp/bot-heartbeat').touch()
def main():
    try:
        bot=Bot(Config())
        for sig in (signal.SIGTERM,signal.SIGINT):signal.signal(sig,lambda *_:bot.stop.set())
        bot.run();return 0
    except Exception:print('{"event":"bot_stopped_safely"}',flush=True);return 1
if __name__=='__main__':raise SystemExit(main())
