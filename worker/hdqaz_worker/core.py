from __future__ import annotations
import json
import math
import os
import random
import re
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', re.I)
CODES = {'download_failed', 'invalid_media', 'processing_failed', 'upload_failed', 'internal_error'}

class Failure(Exception):
    def __init__(self, code='internal_error'):
        self.code = code if code in CODES else 'internal_error'
        super().__init__(self.code)

class LeaseLost(Failure):
    pass

class ApiFailure(Exception):
    def __init__(self, status=0):
        self.status = status
        super().__init__('api_unavailable')

def log(event, **fields):
    # Deliberately do not accept exception strings, URLs, paths, headers or tokens.
    allowed = {'job', 'attempt', 'stage', 'progress', 'code', 'status', 'seconds', 'fps', 'speed', 'bytes', 'width', 'height', 'codec'}
    safe = {k: v for k, v in fields.items() if k in allowed and isinstance(v, (str, int, float))}
    print(json.dumps({'event': event, **safe}), flush=True)

def uuid(value):
    if not isinstance(value, str) or not UUID.fullmatch(value):
        raise Failure()
    return value.lower()

def backoff(attempt, minimum=5, maximum=60, rng=random.random):
    ceiling = min(maximum, minimum * 2 ** min(attempt, 10))
    return ceiling * (0.75 + 0.25 * rng())

def https_origin(value):
    p = urllib.parse.urlsplit(value)
    if p.scheme != 'https' or not p.hostname or p.username or p.password or p.port or p.path or p.query or p.fragment:
        raise Failure()
    return value

@dataclass(frozen=True)
class Config:
    api: str
    token: str
    worker_id: str
    workspace: Path
    sources: Path
    intro: Path
    watermark: Path
    storage: Path
    output_origin: str
    max_source: int = 50 * 1024**3
    min_free: int = 10 * 1024**3
    max_duration: int = 21600
    process_timeout: int = 86400
    source_timeout: int = 3600
    retention_seconds: int = 86400
    retention_bytes: int = 50 * 1024**3
    threads: int = 4
    preset: str = 'medium'
    opacity: float = 0.65
    position: str = 'top-right'
    heartbeat_seconds: int = 30
    poll_min: int = 5
    poll_max: int = 60
    storage_adapter: str = 'local'
    r2_endpoint: str = ''
    r2_bucket: str = ''
    r2_access_key: str = ''
    r2_secret_key: str = ''
    @classmethod
    def from_env(cls):
        e = os.environ
        required = ['HDQAZ_API_BASE_URL','AUTOMATION_WORKER_TOKEN','AUTOMATION_WORKER_ID','WORKER_WORKSPACE',
                    'WORKER_SOURCE_ROOT','WORKER_INTRO_PATH','WORKER_WATERMARK_PATH','WORKER_STORAGE_ROOT','WORKER_OUTPUT_ORIGIN']
        if any(not e.get(k) for k in required):
            raise Failure()
        api = https_origin(e['HDQAZ_API_BASE_URL'])
        origin = https_origin(e['WORKER_OUTPUT_ORIGIN'])
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}',e['AUTOMATION_WORKER_ID']):
            raise Failure()
        token = e['AUTOMATION_WORKER_TOKEN']
        if not 32 <= len(token) <= 512 or re.search(r'\s',token):
            raise Failure()
        if (e.get('WORKER_STORAGE_ADAPTER') or 'local') not in {'local','r2'}:
            raise Failure()  # Actual Cloudflare product must be confirmed before adding its adapter.
        adapter=(e.get('WORKER_STORAGE_ADAPTER') or 'local')
        endpoint=e.get('R2_ENDPOINT_URL','')
        if adapter=='r2':
            if not re.fullmatch(r'https://[a-f0-9]{32}(?:\.eu|\.fedramp)?\.r2\.cloudflarestorage\.com',endpoint): raise Failure()
            if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,61}[a-z0-9]',e.get('R2_BUCKET','')): raise Failure()
            if not e.get('R2_ACCESS_KEY_ID') or not e.get('R2_SECRET_ACCESS_KEY'): raise Failure()
        paths = [Path(e[k]) for k in required[3:8]]
        if any(not p.is_absolute() or p.is_symlink() for p in paths):
            raise Failure()
        workspace, sources, intro, watermark, storage = [p.resolve() for p in paths]
        roots = [workspace,sources,storage]
        if any(a == b or a in b.parents or b in a.parents for i,a in enumerate(roots) for b in roots[i+1:]):
            raise Failure()
        if any(workspace == p or workspace in p.parents for p in [intro,watermark]):
            raise Failure()
        def number(name,default,low,high):
            n=int(e.get(name) or default)
            if not low <= n <= high: raise Failure()
            return n
        preset=(e.get('WORKER_FFMPEG_PRESET') or 'medium')
        position=(e.get('WORKER_WATERMARK_POSITION') or 'top-right')
        opacity=float(e.get('WORKER_WATERMARK_OPACITY') or '0.65')
        if preset not in {'ultrafast','superfast','veryfast','faster','fast','medium','slow'} or position not in {'top-left','top-right','bottom-left','bottom-right'} or not 0 < opacity <= 1:
            raise Failure()
        return cls(api,token,e['AUTOMATION_WORKER_ID'],workspace,sources,intro,watermark,storage,origin,
            max_source=number('WORKER_MAX_SOURCE_BYTES',50*1024**3,1024,1024**4),
            min_free=number('WORKER_MIN_FREE_BYTES',10*1024**3,1024,1024**4),
            max_duration=number('WORKER_MAX_DURATION_SECONDS',21600,1,604740),
            process_timeout=number('WORKER_PROCESS_TIMEOUT_SECONDS',86400,30,604800),
            source_timeout=number('WORKER_SOURCE_TIMEOUT_SECONDS',3600,1,86400),
            retention_seconds=number('WORKER_FAILURE_RETENTION_SECONDS',86400,0,604800),
            retention_bytes=number('WORKER_FAILURE_RETENTION_BYTES',50*1024**3,0,1024**4),
            threads=number('WORKER_FFMPEG_THREADS',4,1,64),preset=preset,opacity=opacity,position=position,
            heartbeat_seconds=number('WORKER_HEARTBEAT_SECONDS',30,5,30),
            poll_min=number('WORKER_POLL_MIN_SECONDS',5,2,60),poll_max=number('WORKER_POLL_MAX_SECONDS',60,60,600),
            storage_adapter=adapter,r2_endpoint=endpoint,r2_bucket=e.get('R2_BUCKET',''),
            r2_access_key=e.get('R2_ACCESS_KEY_ID',''),r2_secret_key=e.get('R2_SECRET_ACCESS_KEY',''))

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

class Api:
    def __init__(self, config):
        self.base, self.token = config.api, config.token
        self.opener = urllib.request.build_opener(NoRedirect(), urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    def call(self, suffix, payload):
        req=urllib.request.Request(self.base+'/api/automation/jobs'+suffix,
            data=json.dumps(payload).encode(), headers={'Authorization':'Bearer '+self.token,'Content-Type':'application/json'}, method='POST')
        try:
            with self.opener.open(req, timeout=10) as response:
                body=bytearray();deadline=time.monotonic()+10
                while True:
                    if time.monotonic()>deadline: raise ApiFailure()
                    chunk=response.read1(min(8192,65537-len(body)))
                    if not chunk: break
                    body.extend(chunk)
                    if len(body)>65536: raise ApiFailure()
                result=json.loads(body)
                if not isinstance(result,dict) or 'data' not in result: raise ApiFailure()
                return result['data']
        except urllib.error.HTTPError as exc:
            raise ApiFailure(exc.code) from None
        except (OSError,ValueError,urllib.error.URLError):
            raise ApiFailure() from None
    def claim(self):
        job=self.call('/claim',{})
        if job is not None:
            if not isinstance(job,dict): raise ApiFailure()
            uuid(job.get('id')); uuid(job.get('lease_token'))
            if job.get('status')!='downloading' or type(job.get('attempt_count')) is not int or not 1 <= job.get('attempt_count',0) <= 10: raise ApiFailure()
        return job

class Lease:
    """Serialize stage transitions/heartbeat/terminal calls; fail closed on uncertainty."""
    def __init__(self, api, job, stop, interval=30):
        self.api,self.job,self.stop,self.interval=api,job,stop,interval
        self.cancel=threading.Event()
        self.done=threading.Event()
        self.lock=threading.RLock()
        self.stage='downloading'
        self.progress=0
        self.thread=threading.Thread(target=self._loop,daemon=True)
        self.closed=False
        self.deadline=time.monotonic()+80
    def check(self):
        if self.cancel.is_set() or self.stop.is_set() or time.monotonic()>=self.deadline:
            self.cancel.set()
            raise LeaseLost()
    def start(self):
        # Renew before work; avoids trusting a delayed claim response's lease clock.
        self.update('downloading',0)
        self.thread.start()
    def _loop(self):
        while not self.done.wait(self.interval):
            try: self.update()
            except (Failure,ApiFailure):
                self.cancel.set(); return
    def update(self, stage=None, progress=None):
        with self.lock:
            self.check()
            if self.closed: return
            stages=['downloading','processing','uploading']
            if stage is not None:
                if stage not in stages or not 0 <= stages.index(stage)-stages.index(self.stage) <= 1: raise Failure()
                self.stage=stage
            if progress is not None:
                if not math.isfinite(progress) or not 0 <= progress <= 99: raise Failure()
                self.progress=max(self.progress,int(progress))
            started=time.monotonic()
            try:
                response=self.api.call('/'+self.job['id']+'/heartbeat',{'lease_token':self.job['lease_token'],
                    'stage':self.stage,'progress_percent':self.progress})
                if not isinstance(response,dict) or response.get('id')!=self.job['id'] or response.get('status')!=self.stage or response.get('progress_percent')!=self.progress:
                    raise ApiFailure()
                self.check()
                self.deadline=started+80
                from .local_state import write
                write('worker.json',{'timestamp':time.time(),'state':self.stage,'id':self.job['id'],'progress':self.progress})
            except ApiFailure:
                self.cancel.set()
                raise LeaseLost() from None
    def set_progress(self,value):
        with self.lock:
            self.check()
            if not math.isfinite(value): raise Failure()
            self.progress=max(self.progress,min(99,max(0,int(value))))
    def terminal(self,action,body):
        with self.lock:
            self.check()
            # Confirm ownership immediately before terminal action; serialized with heartbeat.
            self.update()
            self.done.set()
            payload={'lease_token':self.job['lease_token'],**body}
            # Exact payload replay handles a committed response lost in transit.
            for attempt in range(3):
                self.check()
                try:
                    result=self.api.call('/'+self.job['id']+'/'+action,payload)
                    if not isinstance(result,dict) or result.get('id')!=self.job['id'] or result.get('status') != ('ready' if action=='complete' else 'failed'):
                        raise ApiFailure()
                    self.closed=True
                    return result
                except ApiFailure as exc:
                    if exc.status and exc.status not in {429,500,502,503,504}: break
                    if self.stop.wait(2**attempt): break
            self.cancel.set()
            raise LeaseLost()
    def close(self):
        self.done.set()
        if self.thread.is_alive(): self.thread.join(timeout=12)
