from __future__ import annotations
import os
import platform
import signal
import sys
import threading
import time
from .core import Api, ApiFailure, Config, Failure, Lease, LeaseLost, backoff, log
from .workspace import Workspaces, MountedSource, disk
from .media import Runner, encode
from .storage import LocalStorage, verify_local
from .r2 import R2Storage

class Worker:
    def __init__(self,config,api=None,source=None,storage=None,stop=None):
        self.config=config
        self.api=api or Api(config)
        self.source=source or MountedSource(config)
        self.storage=storage or (R2Storage(config) if config.storage_adapter=='r2' else LocalStorage(config))
        self.stop=stop or threading.Event()
        self.workspaces=Workspaces(config)
    def process(self,job,allow_local_complete=False):
        lease=Lease(self.api,job,self.stop,self.config.heartbeat_seconds)
        workspace=None;started=time.monotonic()
        def timed(stage,operation):
            before=time.monotonic()
            try:return operation()
            finally:log('stage_timing',job=job['id'],stage=stage,seconds=round(time.monotonic()-before,2))
        try:
            lease.start()
            workspace=self.workspaces.create(job)
            source=timed('source_copy',lambda:self.source.acquire(job,workspace/'source.media',lease.check,lambda p:lease.set_progress(p*10)))
            lease.update('processing',10)
            runner=Runner(self.config,lease.check)
            media=timed('probe',lambda:runner.probe(source))
            intro=timed('branding_probe',lambda:runner.probe(self.config.intro))
            if intro.duration>60: raise Failure('invalid_media')
            runner.probe(self.config.watermark,image=True)
            timed('source_validation',lambda:runner.decode(source,media.duration))
            timed('branding_validation',lambda:runner.decode(self.config.intro,intro.duration))
            lease.set_progress(15)
            variants,duration=timed('transcode',lambda:encode(self.config,runner,source,media,intro,workspace/'hls',lambda p:lease.set_progress(15+p*65)))
            files=timed('hls_validation',lambda:verify_local(workspace/'hls',duration,runner,variants))
            lease.update('uploading',82)
            manifest=timed('r2_and_cdn',lambda:self.storage.upload(workspace/'hls',files,job,lease.check,lambda p:lease.set_progress(82+p*16)))
            if not self.storage.remotely_verified and not allow_local_complete:
                raise Failure('upload_failed')
            lease.terminal('complete',{'output_manifest_url':manifest,'output_metadata':{
                'duration_seconds':duration,'width':variants[0].width,'height':variants[0].height,
                'size_bytes':sum((workspace/'hls'/name).stat().st_size for name in files)}})
            # Only after API confirms Ready (including exact replay after lost response).
            self.workspaces.remove(workspace);workspace=None
            log('ready',job=job['id'],attempt=job['attempt_count'])
            return True
        except LeaseLost:
            log('lease_lost',job=job['id'])
        except Exception as exc:
            code=exc.code if isinstance(exc,Failure) else 'internal_error'
            log('job_failed',job=job['id'],code=code)
            try:lease.terminal('fail',{'error_code':code})
            except (LeaseLost,ApiFailure):log('terminal_unconfirmed',job=job['id'])
        finally:
            lease.close()
            log('stage_timing',job=job['id'],stage='total',seconds=round(time.monotonic()-started,2))
            if workspace: os.utime(workspace,None)
            self.workspaces.cleanup()
        return False
    def run(self):
        # Fail closed BEFORE claiming production work until a remote storage adapter is configured.
        if not self.storage.remotely_verified: raise Failure('upload_failed')
        attempt=0
        while not self.stop.is_set():
            self.workspaces.cleanup();self.storage.cleanup_partials()
            disk(self.config.workspace,self.config.max_source,self.config.min_free)
            try:
                job=self.api.claim()
                if job:
                    self.process(job);attempt=0;continue
            except (ApiFailure,Failure) as exc: log('poll_unavailable',status=exc.status if isinstance(exc,ApiFailure) else 0)
            delay=backoff(attempt,self.config.poll_min,self.config.poll_max);attempt+=1
            self.stop.wait(delay)
    def close(self):self.workspaces.close()

def main():
    # User explicitly forbids processing on the Mac; enforce it in the entry point.
    if platform.system()!='Linux': log('linux_server_required');return 2
    stop=threading.Event()
    for sig in [signal.SIGTERM,signal.SIGINT]: signal.signal(sig,lambda *_:stop.set())
    worker=None
    try:
        os.umask(0o077)
        worker=Worker(Config.from_env(),stop=stop)
        worker.run()
    except Exception:log('worker_configuration_or_runtime_failure');return 1
    finally:
        if worker:worker.close()
    return 0

if __name__=='__main__':sys.exit(main())
