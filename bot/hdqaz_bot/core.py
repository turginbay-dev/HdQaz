"""Private Telegram transport. Never log request URLs, response bodies or exceptions."""
import hashlib
import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

class SafeError(Exception):
    def __init__(self,code='unavailable',definite=False):self.code,self.definite=code,definite;super().__init__(code)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args):return None

def request(url,payload,headers=None,timeout=20):
    opener=urllib.request.build_opener(NoRedirect())
    req=urllib.request.Request(url,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json',**(headers or {})},method='POST')
    try:
        with opener.open(req,timeout=timeout) as r:
            body=r.read(1024*1024+1)
            if len(body)>1024*1024:raise SafeError()
            return json.loads(body)
    except urllib.error.HTTPError as e:
        # Only a known HTTP rejection is safe to resend to Telegram, not a timeout/5xx.
        raise SafeError('rejected' if 400<=e.code<500 else 'unavailable',400<=e.code<500) from None
    except (OSError,ValueError,urllib.error.URLError):raise SafeError() from None

class Config:
    def __init__(self):
        e=os.environ
        self.token=e.get('TELEGRAM_BOT_TOKEN','');self.backend=e.get('TELEGRAM_BACKEND_TOKEN','');self.api=e.get('HDQAZ_API_BASE_URL','')
        p=urllib.parse.urlsplit(self.api)
        if p.scheme!='https' or not p.hostname or p.path or p.username or p.password or p.query or p.fragment:raise SafeError('configuration')
        if not re.fullmatch(r'[0-9]+:[A-Za-z0-9_-]{20,}',self.token) or not 32<=len(self.backend)<=512 or re.search(r'\s',self.backend):raise SafeError('configuration')
        raw=e.get('TELEGRAM_ADMIN_USER_IDS','').split(',')
        if not raw or any(not re.fullmatch(r'[1-9][0-9]{0,15}',s.strip()) for s in raw):raise SafeError('configuration')
        self.admins={int(s.strip()) for s in raw}
        if any(x>9007199254740991 for x in self.admins):raise SafeError('configuration')
        self.telegram_base=e.get('TELEGRAM_API_BASE','https://api.telegram.org')
        if self.telegram_base not in ('https://api.telegram.org','http://telegram-api:8081'):raise SafeError('configuration')
        self.telegram_root=Path('/telegram-data')
        self.state_root=Path(e.get('BOT_STATE_ROOT','/state'))
        self.root=Path(e.get('BOT_SOURCE_ROOT','/handoff'))
        self.max_source=int(e.get('BOT_MAX_SOURCE_BYTES','8589934592'))
        if not self.root.is_absolute() or self.root.is_symlink() or not 1024<=self.max_source<=1024**4:raise SafeError('configuration')

class Backend:
    def __init__(self,c):self.c=c
    def call(self,action,actor=None,id=None,revision=None,data=None,key=None):
        body={'action':action,'data':data or {}}
        if id:body['id']=id
        if revision is not None:body['revision']=revision
        if key:body['request_id']=key
        headers={'Authorization':'Bearer '+self.c.backend}
        if actor:headers['X-Telegram-User-Id']=str(actor)
        r=request(self.c.api+'/api/telegram/admin',body,headers)
        if 'data' not in r:raise SafeError()
        return r['data']
class Telegram:
    def __init__(self,c):self.c=c;self.last_send={};self.send_lock=threading.Lock()
    def call(self,method,data,timeout=20):
        r=request(getattr(self.c,'telegram_base','https://api.telegram.org')+'/bot'+self.c.token+'/'+method,data,timeout=timeout)
        if r.get('ok') is not True:raise SafeError('rejected',True)
        return r['result']
    def send(self,chat,text,buttons=None):
        with self.send_lock:
            delay=1.05-(time.monotonic()-self.last_send.get(chat,0))
            if delay>0:time.sleep(delay)
            self.last_send[chat]=time.monotonic()
            p={'chat_id':chat,'text':text[:3900],'link_preview_options':{'is_disabled':True}}
            if buttons:p['reply_markup']={'inline_keyboard':buttons}
            return self.call('sendMessage',p)

def authorized(update,admins):
    event=update.get('callback_query') or update.get('message') or {}
    message=event.get('message') if 'callback_query' in update else event
    user=event.get('from',{});chat=(message or {}).get('chat',{})
    actor=user.get('id')
    return actor if type(actor) is int and actor in admins and chat.get('type')=='private' and chat.get('id')==actor and not user.get('is_bot') else None

def request_key(actor,update_id,action):return str(uuid.uuid5(uuid.NAMESPACE_URL,f'hdqaz:{actor}:{update_id}:{action}'))
def button(w,action,label):return {'text':label,'callback_data':w['id'].replace('-','')+':'+str(w['revision'])+':'+action}
def callback(value):
    if not isinstance(value,str) or len(value.encode())>64:raise SafeError('stale')
    m=re.fullmatch(r'([a-f0-9]{32}):([0-9]{1,10}):([a-z]+(?:[0-9]+)?)',value)
    if not m:raise SafeError('stale')
    return str(uuid.UUID(m[1])),int(m[2]),m[3]

class Sources:
    """Operator stages immutable regular files in /handoff/inbox; bot hard-links only.
    Inbox and output share ONE mount, so no network download/copy/video processing occurs.
    Worker keeps its existing read-only /sources/<job UUID>.media contract.
    """
    def __init__(self,c):self.c=c
    def source(self,reference):
        try:ref=str(uuid.UUID(reference))
        except (ValueError,TypeError):raise SafeError('invalid_source') from None
        path=self.c.root/'inbox'/(ref+'.media')
        if path.parent.is_symlink() or path.is_symlink():raise SafeError('invalid_source')
        import stat
        st=path.stat()
        if not stat.S_ISREG(st.st_mode) or not 0<st.st_size<=self.c.max_source or st.st_mode&0o222:raise SafeError('invalid_source')
        return path,st
    def stage(self,reference,job):
        source,st=self.source(reference);target=self.c.root/(str(uuid.UUID(job))+'.media')
        try:os.link(source,target,follow_symlinks=False)
        except FileExistsError:
            if target.is_symlink() or not os.path.samestat(st,target.stat()):raise SafeError('source_conflict') from None
        current=source.stat()
        if target.is_symlink() or not os.path.samestat(st,target.stat()) or (current.st_ino,current.st_size,current.st_mtime_ns)!=(st.st_ino,st.st_size,st.st_mtime_ns):raise SafeError('source_changed')
