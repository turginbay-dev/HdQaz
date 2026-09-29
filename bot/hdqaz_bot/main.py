import json
import os
import signal
import threading
import time
import uuid
from .core import Backend,Config,SafeError,Sources,Telegram,authorized,button,callback,request_key

MENU=[[{'text':'🎬 Movie','callback_data':'menu_movie'},{'text':'📺 Series','callback_data':'menu_series'}],[{'text':'📋 Queue / Status','callback_data':'menu_queue'}]]
class Bot:
    def __init__(self,c,backend=None,telegram=None,sources=None):
        self.c=c;self.api=backend or Backend(c);self.tg=telegram or Telegram(c);self.sources=sources or Sources(c)
        self.owner=str(uuid.uuid4());self.stop=threading.Event();self.last_success=time.monotonic();self.lease_deadline=None
    def show(self,actor,w):
        m=w['metadata'];j=w.get('job');text=m.get('title','Жаңа '+w['kind'])+'\n'+str(m.get('year',''))+'\n'+m.get('description','')[:900]
        text+='\nКүй: '+w['state']
        text+='\nЕлі: '+m.get('country','—')+' · Ұзақтығы: '+str(m.get('duration_minutes') or '—')
        text+='\nЖанрлар: '+', '.join(m.get('genres',[]))
        if w.get('source_ref'):text+='\nSource: '+w['source_ref']
        if w['kind']=='series':text+='\nМаусым / серия: '+str(m.get('season_number','—'))+' / '+str(m.get('episode_number','—'))
        text+='\nPremium: '+str(m.get('is_premium',False))+'\nДыбыстаушы: '+str(m.get('dubber_id','—'))
        buttons=[]
        if j:
            text+='\n'+j['status']+' '+str(j['progress_percent'])+'% · '+str(j['attempt_count'])+'/'+str(j['max_attempts'])
            if j.get('error_code'):text+='\nҚате: '+j['error_code']
            if j['status']=='ready' and w['state']=='submitted':
                text+='\nТексеру: '+j['output_manifest_url']+'\nЖариялау тек төмендегі нақты растаудан кейін орындалады.'
                buttons.append([button(w,'publish','✅ Тексердім — жариялау'),button(w,'reject','❌ Қабылдамау')])
            if j['status']=='failed' and j['attempt_count']<j['max_attempts'] and w['state']=='submitted':buttons.append([button(w,'retry','Қайта орындау')])
        if w['state']=='draft':
            text+='\n/edit title=Қазақша атауы\n/edit description=Мәтін\n/edit year=2026\n/edit is_premium=false\n/dubbers → /edit dubber_id=UUID'
            if w['kind']=='series':text+='\n/edit season_number=1\n/edit episode_number=1\n/edit episode_title=Атауы'
            text+='\n/edit country=Қазақстан\n/edit duration_minutes=90\n/edit genres=Драма\n/source UUID — серверге алдын ала қойылған файл'
            if w.get('source_ref'):buttons.append([button(w,'prepare','Өңдеуге жіберуді растау')])
        if w['state']=='staging':buttons.append([button(w,'activate','Source handoff жалғастыру')])
        if w['state']=='published':buttons.append([button(w,'postretry','Арна постын қайта жіберу (қате болса)')])
        buttons.append([button(w,'get','Жаңарту'),{'text':'📋 Queue','callback_data':'menu_queue'}])
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
            except Exception:
                if self.lease_deadline is not None and time.monotonic()>=self.lease_deadline:self.stop.set()
    def mutate(self,w,actor,update,action,data=None):
        self.guard()
        return self.api.call(action,actor,w['id'],w['revision'],data,request_key(actor,update,action))
    def handle(self,u):
        self.guard()
        actor=authorized(u,self.c.admins)
        if actor is None:return
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
                    except (SafeError,ValueError,KeyError,OSError):
                        actor=authorized(u,self.c.admins)
                        if actor:self.tg.send(actor,'Әрекет орындалмады немесе күйі өзгерді. /queue арқылы тексеріп, жаңартыңыз.')
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
