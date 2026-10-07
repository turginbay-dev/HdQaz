"""Automatic LOCAL maintenance, hosted by the existing cleanup executor.

No remote storage client is imported here. Unknown authority/process state retains data.
"""
import contextlib
import fcntl
import hashlib
import json
import os
import re
import shutil
import stat
import time
from pathlib import Path

UUID=r'[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
WORK=re.compile('^('+UUID+r')-([1-9][0-9]*)-[0-9a-f]{16}$')
MEDIA=re.compile('^('+UUID+r')\.media$')
PARTIAL=re.compile(r'^\.tg-('+UUID+r')\.partial$')
TERMINAL={'ready','failed'}
ACTIVE={'downloading','processing','uploading'}
MARKER='.hdqaz-worker-owned'

class Unsafe(ValueError):pass
class Busy(Exception):pass

def settings(env=os.environ):
    def number(name,default,lo,hi):
        n=int(env.get(name) or default)
        if not lo<=n<=hi:raise Unsafe(name)
        return n
    enabled=env.get('CLEANUP_ENABLED','false').lower()
    if enabled not in ('true','false'):raise Unsafe('CLEANUP_ENABLED')
    s={'enabled':enabled=='true','heartbeat':number('STALE_HEARTBEAT_MINUTES',10,2,1440)*60,
       'stale':number('STALE_PROGRESS_MINUTES',30,30,10080)*60,
       'orphan':number('ORPHAN_MAX_AGE_MINUTES',60,60,10080)*60,
       'warning':number('DISK_WARNING_PERCENT',80,50,98),
       'critical':number('DISK_CRITICAL_PERCENT',90,60,99),
       'interval':number('CLEANUP_INTERVAL_SECONDS',600,30,86400)}
    if s['warning']>=s['critical']:raise Unsafe('threshold_order')
    return s

def usage(root):
    d=shutil.disk_usage(root)
    return {'total':d.total,'used':d.total-d.free,'free':d.free,'percent':round((d.total-d.free)*100/d.total,2)}

def atomic(path,value):
    if path.is_symlink():raise Unsafe('symlink')
    tmp=path.with_name(path.name+'.tmp')
    fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'w') as f:json.dump(value,f);f.flush();os.fsync(f.fileno())
    os.replace(tmp,path)

def read(path,default):
    try:
        if path.is_symlink() or path.stat().st_size>2*1024*1024:raise Unsafe('state')
        return json.loads(path.read_text())
    except FileNotFoundError:return default

def boundary(root,path):
    root=Path(root);path=Path(path)
    forbidden={'/','/etc','/var','/home','/root','/usr','/opt','/tmp','/var/lib/docker'}
    if str(root) in forbidden or not root.is_absolute() or root.is_symlink() or root.resolve()!=root:raise Unsafe('root')
    if path.is_symlink() or path.parent!=root or path.resolve().parent!=root or path==root:raise Unsafe('boundary')
    return path

def fingerprint(path):
    # Do not follow nested symlinks; deletion likewise never follows them.
    total=0;latest=path.lstat().st_mtime_ns;count=0;digest=hashlib.sha256()
    items=[path] if path.is_file() else path.rglob('*')
    for item in items:
        info=item.lstat()
        if stat.S_ISLNK(info.st_mode):raise Unsafe('nested_symlink')
        if stat.S_ISREG(info.st_mode):
            total+=info.st_size;count+=1;latest=max(latest,info.st_mtime_ns)
            digest.update((str(item.relative_to(path.parent))+':'+str(info.st_size)+':'+str(info.st_mtime_ns)).encode())
        elif not stat.S_ISDIR(info.st_mode):raise Unsafe('special_file')
    return {'bytes':total,'mtime_ns':latest,'count':count,'digest':digest.hexdigest()}

@contextlib.contextmanager
def locked_file(path):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):raise Unsafe('not_regular')
        try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise Busy() from None
        if not os.path.samestat(os.fstat(fd),path.stat()):raise Busy()
        yield fd
    finally:os.close(fd)

def remove_directory(root,path):
    boundary(root,path)
    if not WORK.fullmatch(path.name) or not path.is_dir():raise Unsafe('job_directory')
    marker=path/MARKER
    if marker.is_symlink() or not marker.is_file():raise Unsafe('ownership')
    if not shutil.rmtree.avoids_symlink_attacks:raise Unsafe('platform')
    size=fingerprint(path)['bytes'];shutil.rmtree(path);return size

def remove_media(root,path):
    boundary(root,path)
    if not (MEDIA.fullmatch(path.name) or PARTIAL.fullmatch(path.name)):raise Unsafe('media_name')
    info=path.lstat()
    if not stat.S_ISREG(info.st_mode):raise Unsafe('media_type')
    # Hard links are accounted only when the final link is removed.
    freed=info.st_blocks*512 if info.st_nlink==1 else 0
    path.unlink();return freed

def terminal(job):return job and job.get('status') in TERMINAL

def expired(job,now):
    from datetime import datetime
    try:return datetime.fromisoformat(job['lease_expires_at'].replace('Z','+00:00')).timestamp()<now
    except (ValueError,KeyError,TypeError):return False

def heartbeat_age(job,now):
    from datetime import datetime
    try:return now-datetime.fromisoformat(job['heartbeat_at'].replace('Z','+00:00')).timestamp()
    except (ValueError,KeyError,TypeError):return 0

class Maintenance:
    def __init__(self,work,sources,state,call,ingestions,config=None,clock=time.time):
        self.work=Path(work);self.sources=Path(sources);self.state=Path(state)
        self.call=call;self.ingestions=ingestions;self.cfg=config or settings();self.clock=clock
        self.state.mkdir(mode=0o700,parents=True,exist_ok=True)
        if self.state.is_symlink():raise Unsafe('state_root')
        self.observed=read(self.state/'observations.json',{});self.last_scan=0;self.pressure=0;self.cpu_sample=None
        self.report=read(self.state/'storage.json',{});self.last_cleanup=self.report.get('last_cleanup');self.authority_available=self.report.get('authority_available',True)
    def event(self,kind,**fields):
        queue=self.state/'events';queue.mkdir(exist_ok=True,mode=0o700)
        if queue.is_symlink():raise Unsafe('events')
        # IDs are stable for a job/reason/attempt. Acknowledged events aren't recreated.
        key=hashlib.sha256(json.dumps([kind,fields.get('job'),fields.get('attempt'),fields.get('reason'),fields.get('epoch')],sort_keys=True).encode()).hexdigest()
        if (self.state/'ack'/key).exists():return
        if len(list(queue.iterdir()))>=500:return # bounded; structured logs remain authoritative
        atomic(queue/key,{'kind':kind,'timestamp':self.clock(),**fields})
    def observe(self,path,job):
        sample=fingerprint(path);key=str(path)
        signature=[sample,job.get('attempt_count') if job else None,job.get('progress_percent') if job else None]
        old=self.observed.get(key)
        if not old or old['signature']!=signature:self.observed[key]={'signature':signature,'since':self.clock()}
        return sample,self.clock()-self.observed[key]['since']
    def record(self,path,job,reason,before,bytes_freed):
        after=usage(self.work);now=self.clock()
        record={'job_id':job.get('id') if job else None,'reason':reason,'deleted_path':str(path),'bytes_freed':bytes_freed,'timestamp':now,'disk_before':before,'disk_after':after}
        print(json.dumps({'event':'local_cleanup',**record}),flush=True)
        self.scan_freed=getattr(self,'scan_freed',0)+bytes_freed
        self.last_cleanup={'timestamp':now,'bytes':self.scan_freed,'reason':reason}
        if reason not in ('ready','source_terminal'):self.event('cleanup',job=record['job_id'],attempt=job.get('attempt_count') if job else None,title=(job or {}).get('title','Видео')[:160],reason=reason,bytes=bytes_freed,disk=after,epoch=int(now//self.cfg['interval']) if not job else None)
    def scan(self):
        now=self.clock();candidates=[];ids=set();refs=set();self.scan_freed=0
        for path in self.work.iterdir():
            m=WORK.fullmatch(path.name)
            if m and not path.is_symlink() and path.is_dir():candidates.append(('work',path,m[1]));ids.add(m[1])
        for root,kind,pattern in [(self.sources,'job',MEDIA),(self.sources/'inbox','source',MEDIA),(self.sources/'inbox','partial',PARTIAL)]:
            if root.is_symlink():raise Unsafe('source_root')
            if not root.exists():continue
            for path in root.iterdir():
                m=pattern.fullmatch(path.name)
                if m and not path.is_symlink():candidates.append((kind,path,m[1]));(ids if kind=='job' else refs).add(m[1])
        local=self.ingestions()
        refs.update(s['source_ref'] for s in local if isinstance(s.get('source_ref'),str) and re.fullmatch(UUID,s['source_ref']))
        # Batch, never silently treat truncated lists as absence.
        jobs={};sources={}
        for group,key in [(sorted(ids),'jobs'),(sorted(refs),'sources')]:
            for start in range(0,len(group),100):
                data=self.call({'action':'local_inspect','jobs':group[start:start+100] if key=='jobs' else [],'sources':group[start:start+100] if key=='sources' else []})
                jobs.update((j['id'],j) for j in data['jobs']);sources.update((s['id'],s) for s in data['sources'])
        local=self.ingestions() # Failure to read durable bot state MUST abort, not assume idle.
        busy_refs={s.get('source_ref') for s in local if s.get('mode')=='ingest'}
        recovering={s.get('job_id') for s in local if s.get('mode')=='ingest'}
        stale=0
        for kind,path,key in candidates:
            try:
                boundary(self.work if kind=='work' else path.parent,path)
                job=jobs.get(key) if kind in ('work','job') else None
                sample,unchanged=self.observe(path,job)
                old=now-sample['mtime_ns']/1e9>=self.cfg['orphan']
                reason=None
                if kind in ('source','partial'):
                    if key in busy_refs:continue
                    references=sources.get(key)
                    if references is None:continue
                    flows=references['flows']
                    if any(f['state'] in ('draft','staging') or not terminal(jobs.get(f.get('job_id'))) for f in flows):continue
                    if not flows and not old:continue
                    job=next((jobs.get(f.get('job_id')) for f in flows if jobs.get(f.get('job_id'),{}).get('status')=='failed'),None)
                    reason=('cancelled' if job.get('admin_cancelled_at') else 'failed') if job else 'source_terminal' if flows else 'orphan'
                elif terminal(job):reason='cancelled' if job.get('admin_cancelled_at') else job['status']
                elif job is None:
                    if not old:continue
                    reason='orphan'
                elif job['status'] in ACTIVE and expired(job,now) and heartbeat_age(job,now)>=max(self.cfg['heartbeat'],self.cfg['stale']) and unchanged>=self.cfg['stale']:
                    stale+=1;reason='stale'
                else:continue
                if key in recovering:continue
                # A child inherits the workspace and source locks even if the parent crashes.
                lockpath=path/MARKER if kind=='work' else path
                with locked_file(lockpath):
                    # Legacy workspaces have no inherited per-job lock: require idle worker root lock.
                    with contextlib.ExitStack() as stack:
                        if kind=='work' and (path/MARKER).read_text()!='v2':stack.enter_context(locked_file(self.work/'.lock'))
                        if reason=='stale':
                            result=self.call({'action':'local_stale','id':key,'heartbeat_at':job['heartbeat_at'],'attempt_count':job['attempt_count'],'progress_percent':job['progress_percent']})
                            if not result['failed']:continue
                            job={**job,'status':'failed','error_code':'STALE_JOB_CLEANUP'};jobs[key]=job
                        # Re-check filesystem immediately while locked. Changes reset observation.
                        if fingerprint(path)!=sample:continue
                        before=usage(self.work)
                        freed=remove_directory(self.work,path) if kind=='work' else remove_media(path.parent,path)
                        self.record(path,job,reason,before,freed)
            except (Busy,FileNotFoundError):continue
            except (Unsafe,OSError):print(json.dumps({'event':'local_cleanup_retained','reason':'unsafe_or_busy','job_id':key}),flush=True)
        self.cleanup_cache(local,sources,jobs)
        existing={str(p) for _,p,_ in candidates if p.exists()}
        self.observed={k:v for k,v in self.observed.items() if k in existing}
        atomic(self.state/'observations.json',self.observed)
        return {'active_jobs':sum(j['status'] in ACTIVE for j in jobs.values()),'stale_jobs':stale}
    def cleanup_cache(self,local,sources,jobs):
        root=Path('/telegram-data')
        if not root.exists():return
        if root.is_symlink() or any(s.get('mode')=='ingest' for s in local):return
        for s in local:
            value=s.get('cache_path');ref=s.get('source_ref');entry=sources.get(ref)
            if not value or not entry or not entry['flows']:continue
            if any(f['state'] in ('draft','staging') or not terminal(jobs.get(f.get('job_id'))) for f in entry['flows']):continue
            parts=Path(value).parts
            # Bot API metadata/database and global cache directories are never deletion targets.
            if len(parts)!=3 or any(part in ('.','..','/') for part in parts) or Path(value).is_absolute() or parts[1] not in ('videos','documents') or parts[2] in ('.','..') or not parts[2].startswith('file_'):continue
            path=root.joinpath(*parts)
            try:
                if any(p.is_symlink() for p in (root/parts[0],path.parent,path)) or not path.is_file():continue
                if path.resolve().parent!=path.parent:continue
                with locked_file(path):
                    info=path.stat()
                    if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1:continue
                    path.unlink()
                    # Never log Telegram cache paths: a parent component can contain a token.
                    print(json.dumps({'event':'local_telegram_cache_cleanup','workflow':s.get('id'),'bytes_freed':info.st_blocks*512,'timestamp':self.clock()}),flush=True)
            except (Busy,OSError):continue
    def system_usage(self):
        try:
            values=[int(x) for x in Path('/proc/stat').read_text().splitlines()[0].split()[1:9]]
            total=sum(values);idle=values[3]+values[4];cpu=None
            if self.cpu_sample and total>self.cpu_sample[0]:cpu=round(100*(1-(idle-self.cpu_sample[1])/(total-self.cpu_sample[0])),1)
            self.cpu_sample=(total,idle)
            memory={line.split(':')[0]:int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines()}
            return {'cpu_percent':cpu,'ram_total':memory['MemTotal'],'ram_used':memory['MemTotal']-memory['MemAvailable']}
        except (OSError,ValueError,KeyError):return {}
    def tick(self,force=False):
        now=self.clock();disk=usage(self.work);level=2 if disk['percent']>=self.cfg['critical'] else 1 if disk['percent']>=self.cfg['warning'] else 0
        stats={k:self.report.get(k,0) for k in ('active_jobs','stale_jobs')};healthy=self.authority_available
        trigger=self.state/'cleanup-request'
        due=force or trigger.exists() or now-self.last_scan>=self.cfg['interval'] or level>self.pressure
        if self.cfg['enabled'] and due:
            try:
                with locked_file(self.state/'source-lock'):stats=self.scan()
                self.last_scan=now;trigger.unlink(missing_ok=True);healthy=True
            except Busy:pass
            except Exception:healthy=False;print('{"event":"local_cleanup_unavailable","retained":true}',flush=True)
        disk=usage(self.work)
        if level>self.pressure:self.event('disk',disk=disk,reason='critical' if level==2 else 'warning',epoch=int(now//self.cfg['interval']))
        self.pressure=level
        self.authority_available=healthy
        self.report={'timestamp':now,'enabled':self.cfg['enabled'],'disk':disk,'claiming_paused':disk['percent']>=self.cfg['critical'] or not healthy,'authority_available':healthy,'last_cleanup':self.last_cleanup,'system':self.system_usage(),**stats}
        atomic(self.state/'storage.json',self.report)
        return self.report
