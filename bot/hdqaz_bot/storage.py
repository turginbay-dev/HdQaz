"""Private storage UI and SourceProvider recovery. Telegram credentials stay in the bot."""
import json,os,time,threading,uuid
from pathlib import Path
from .core import SafeError
from .ingestion import stage_local

def read(path,default=None):
    try:
        if path.is_symlink() or path.stat().st_size>2*1024*1024:raise SafeError('configuration')
        return json.loads(path.read_text())
    except FileNotFoundError:return default

def atomic(path,data):
    temporary=path.with_name(path.name+'.tmp-bot')
    fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'w') as f:json.dump(data,f);f.flush();os.fsync(f.fileno())
    os.replace(temporary,path)

def gb(value):return f'{value/1024**3:.1f} GB'

class StorageAdmin:
    def __init__(self,bot):
        self.b=bot;self.root=Path(os.environ['BOT_CONTROL_ROOT']);self.recoveries=set();self.lock=threading.Lock()
        if not self.root.is_absolute() or self.root.is_symlink() or not self.root.is_dir():raise SafeError('configuration')
    def command(self,actor,text):
        if text not in ('/disk','/status','/cleanup'):return False
        report=read(self.root/'storage.json')
        if not report or time.time()-report['timestamp']>180:
            self.b.tg.send(actor,'⚠️ Storage қызметінен жаңа күй алынбады. Файлдар қауіпсіздік үшін сақталады.');return True
        if text=='/cleanup':
            if not report.get('enabled'):
                self.b.tg.send(actor,'Қауіпсіз тазарту әзірге қосылмаған.');return True
            atomic(self.root/'cleanup-request',{'timestamp':time.time()})
            self.b.tg.send(actor,'🧹 Қауіпсіз тексеру сұралды. Белсенді өңдеу файлдары сақталады.');return True
        d=report['disk'];lines=['💾 HD Qaz Server Storage',f"Total: {gb(d['total'])}",f"Used: {gb(d['used'])}",f"Free: {gb(d['free'])}",f"Usage: {d['percent']}%",'',f"🎬 Active jobs: {report.get('active_jobs',0)}",f"⚠️ Stale jobs: {report.get('stale_jobs',0)}"]
        last=report.get('last_cleanup')
        if last:lines.extend([f"🧹 Last cleanup: {gb(last['bytes'])}",f"⏱ {max(0,int((time.time()-last['timestamp'])/60))} min ago"])
        if report['claiming_paused']:lines.append('⏸ Жаңа тапсырма алу уақытша тоқтатылды.')
        if text=='/status':
            worker=read(self.root/'worker.json',{});online=time.time()-worker.get('timestamp',0)<120
            lines[0]='Worker: '+('🟢 Online' if online else '⚠️ Күйі ескірген')
            system=report.get('system',{})
            if system.get('cpu_percent') is not None:lines.append(f"CPU: {system['cpu_percent']}%")
            if system.get('ram_total'):lines.append(f"RAM: {gb(system['ram_used'])} / {gb(system['ram_total'])}")
            if worker.get('state') in ('downloading','processing','uploading'):lines.append('⚙️ '+str(worker.get('title') or 'Видео')+' · '+str(worker.get('progress',0))+'%')
        self.b.tg.send(actor,'\n'.join(lines));return True
    def notify(self):
        events=self.root/'events';ack=self.root/'ack';ack.mkdir(exist_ok=True,mode=0o700)
        if events.is_symlink() or ack.is_symlink():raise SafeError('configuration')
        if not events.exists():return
        for path in sorted(events.iterdir())[:10]:
            if len(path.name)!=64 or any(c not in '0123456789abcdef' for c in path.name):continue
            e=read(path);key=ack/path.name
            previous=read(key,{})
            if all(str(actor) in previous for actor in self.b.c.admins):path.unlink();continue
            d=e.get('disk',{});reason=e.get('reason','')
            if e['kind']=='disk':text=('🚨 Server disk critical' if reason=='critical' else '⚠️ Server disk warning')+'\n🧹 Cleanup triggered automatically'
            else:text=('⚠️ Stuck processing detected' if reason=='stale' else '🧹 Local files cleaned')+'\n🎬 '+e.get('title','Видео')+'\nReason: '+reason+'\n💾 Freed: '+gb(e.get('bytes',0))
            if e.get('job'):text+='\n🆔 '+e['job']
            if d:text+=f"\n📊 Disk: {gb(d['used'])} / {gb(d['total'])} ({d['percent']}%)\n🆓 {gb(d['free'])}"
            # Per-recipient durable acknowledgement. Do not resend uncertain Telegram responses.
            sent=read(key,{})
            for actor in sorted(self.b.c.admins):
                if str(actor) in sent:continue
                try:self.b.tg.send(actor,text);sent[str(actor)]='sent'
                except SafeError as exc:
                    if exc.definite:raise
                    sent[str(actor)]='uncertain'
                atomic(key,sent)
            path.unlink()
    def recover(self):
        request=read(self.root/'source-request.json')
        if not request or time.time()-request.get('timestamp',0)>3700:return
        job=str(uuid.UUID(request['id']));attempt=request['attempt'];key=(job,attempt)
        if (self.b.c.root/(job+'.media')).exists():return
        with self.lock:
            if key in self.recoveries:return
        flow=self.b.movie
        with flow.db_lock:rows=[json.loads(r[0]) for r in flow.db.execute('select data from ingestions')]
        for s in rows:
            if s.get('mode')=='ingest' or not s.get('file_id') or s.get('actor') not in self.b.c.admins:continue
            # Old records predate stored job_id: resolve the existing workflow, never guess ownership.
            if s.get('job_id') and s['job_id']!=job:continue
            w=self.b.api.call('get',s['actor'],s['id']);j=w.get('job') or {}
            if j.get('id')!=job or j.get('attempt_count')!=attempt or j.get('status') not in ('queued','downloading'):continue
            s.update(job_id=job,mode='ingest')
            identity=(s['actor'],s['id'],s['file_id'])
            with self.lock:self.recoveries.add(key)
            with flow.db_lock:flow.db.execute('insert or replace into ingestions values(?,?)',(s['id'],json.dumps(s)));flow.db.commit()
            try:started=self.b.start_ingestion(self._download,s,key,identity=identity,reserve=s['file_size']*2)
            except SafeError:started=False
            if not started:
                with self.lock:self.recoveries.discard(key)
                s['mode']='interrupted'
                with flow.db_lock:flow.db.execute('insert or replace into ingestions values(?,?)',(s['id'],json.dumps(s)));flow.db.commit()
            return
    def _download(self,s,key):
        b=self.b;flow=b.movie;finished=False;last_check=[0]
        def check():
            b.guard()
            if (b.c.root/('.cleanup-'+s['id'])).exists():raise SafeError('stale')
            if time.monotonic()-last_check[0]>10:
                j=(b.api.call('get',s['actor'],s['id']).get('job') or {})
                if j.get('id')!=key[0] or j.get('attempt_count')!=key[1] or j.get('status') not in ('queued','downloading'):raise SafeError('stale')
                last_check[0]=time.monotonic()
        try:
            check()
            try:b.sources.source(s['source_ref'])
            except (OSError,SafeError):
                file=b.tg.call('getFile',{'file_id':s['file_id']},timeout=3600);check()
                if file.get('file_size')!=s['file_size']:raise SafeError('source_changed')
                s['cache_path']=str(Path(file['file_path']).relative_to(b.c.telegram_root))
                with flow.db_lock:flow.db.execute('insert or replace into ingestions values(?,?)',(s['id'],json.dumps(s)));flow.db.commit()
                stage_local(b.c.telegram_root,file['file_path'],b.c.root/'inbox',s['source_ref'],s['file_size'],b.c.max_source,check)
            check();b.sources.stage(s['source_ref'],key[0]);finished=True
        except Exception:
            # Single bounded attempt per job attempt. Existing worker reports download_failed safely.
            try:b.tg.send(s['actor'],'⚠️ Retry үшін бастапқы видео алынбады. Видео файлын қайта жіберу қажет болуы мүмкін.')
            except SafeError:pass
        finally:
            s['mode']='done' if finished else 'interrupted'
            with flow.db_lock:flow.db.execute('insert or replace into ingestions values(?,?)',(s['id'],json.dumps(s)));flow.db.commit()
    def run(self):
        while not self.b.stop.is_set():
            try:self.b.guard();self.recover();self.notify()
            except Exception:print('{"event":"storage_monitor_unavailable"}',flush=True)
            self.b.stop.wait(10)
