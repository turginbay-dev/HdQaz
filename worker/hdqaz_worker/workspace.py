from __future__ import annotations
import fcntl
import os
import shutil
import stat
import time
from pathlib import Path
from typing import Protocol
from .core import Failure, LeaseLost, uuid

MARKER='.hdqaz-worker-owned'

def regular(path):
    try:
        mode=path.lstat().st_mode
        if not stat.S_ISREG(mode): raise Failure('invalid_media')
    except OSError: raise Failure('invalid_media') from None
    return path

def disk(path, needed, reserve):
    if shutil.disk_usage(path).free < needed+reserve: raise Failure('processing_failed')

def exclusive_copy(source,destination,limit,check,progress=lambda _:None,timeout=3600,reserve=0):
    start=time.monotonic()
    # Source root is a trusted read-only mount; O_NOFOLLOW rejects a replaced final symlink.
    fd=os.open(source,os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(fd,'rb') as src:
        info=os.fstat(src.fileno())
        if not stat.S_ISREG(info.st_mode) or not 0<info.st_size<=limit: raise Failure('download_failed')
        total=0
        with open(destination,'xb') as out:
            while True:
                check()
                if time.monotonic()-start>timeout: raise Failure('download_failed')
                block=src.read(1024*1024)
                if not block: break
                total+=len(block)
                if total>limit: raise Failure('download_failed')
                disk(destination.parent,len(block),reserve)
                out.write(block)
                progress(total/info.st_size)
            out.flush();os.fsync(out.fileno())
        if total!=info.st_size: raise Failure('download_failed')
        return total

class SourceProvider(Protocol):
    def acquire(self, job: dict, destination: Path, check, progress) -> Path: ...

class MountedSource:
    """Operator atomically stages <job UUID>.media before starting/polling worker."""
    def __init__(self,config): self.config=config;self.handle=None
    def close(self):
        if self.handle:self.handle.close();self.handle=None
    def acquire(self,job,destination,check,progress):
        self.close()
        source=self.config.sources/(uuid(job['id'])+'.media')
        try:
            from .local_state import root,write
            control=root();start=time.monotonic()
            if control and not source.exists():
                write('source-request.json',{'id':uuid(job['id']),'attempt':job['attempt_count'],'timestamp':time.time()})
                while not source.exists():
                    check()
                    if time.monotonic()-start>self.config.source_timeout:raise Failure('download_failed')
                    time.sleep(0.5)
            regular(source)
            self.handle=os.fdopen(os.open(source,os.O_RDONLY|os.O_NOFOLLOW),'rb')
            fcntl.flock(self.handle,fcntl.LOCK_SH|fcntl.LOCK_NB)
            if not os.path.samestat(os.fstat(self.handle.fileno()),source.stat()):raise Failure('download_failed')
            info=source.stat()
            if not 0<info.st_size<=self.config.max_source:raise Failure('download_failed')
            # Telegram handoff is immutable and mounted read-only: use its owned
            # file directly, never chmod/link/remove the Bot API's cached file.
            if not info.st_mode & 0o222:
                check();disk(destination.parent,0,self.config.min_free);progress(1)
                return source
            disk(destination.parent,info.st_size,self.config.min_free)
            exclusive_copy(source,destination,self.config.max_source,check,progress,
                self.config.source_timeout,self.config.min_free)
            return destination
        except LeaseLost:
            self.close();raise
        except Failure as exc:
            self.close()
            if exc.code=='processing_failed': raise
            raise Failure('download_failed') from None
        except OSError:
            self.close();raise Failure('download_failed') from None

class Workspaces:
    def __init__(self,config):
        self.config=config
        self.root=config.workspace
        self.handles={}
        self.root.mkdir(parents=True,exist_ok=True,mode=0o700)
        if self.root.is_symlink(): raise Failure()
        os.chmod(self.root,0o700)
        # One process per workspace volume; independent worker instances use separate volumes.
        self.lock=open(self.root/'.lock','a')
        try: fcntl.flock(self.lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:
            self.lock.close()
            raise Failure() from None
    def create(self,job):
        path=self.root/(uuid(job['id'])+'-'+str(int(job['attempt_count']))+'-'+os.urandom(8).hex())
        path.mkdir(mode=0o700)
        (path/MARKER).write_text('v2')
        handle=open(path/MARKER,'r');fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
        self.handles[path]=handle
        return path
    def remove(self,path):
        # Never follow symlinks or permit callers to remove root/ancestors/foreign paths.
        path=Path(path)
        if self.root.resolve()==Path('/') or path.resolve().parent!=self.root.resolve() or path.parent!=self.root or path.is_symlink() or not path.is_dir() or not (path/MARKER).is_file() or (path/MARKER).is_symlink():
            raise Failure()
        if not shutil.rmtree.avoids_symlink_attacks: raise Failure()
        shutil.rmtree(path)
        handle=self.handles.pop(path,None)
        if handle:handle.close()
    def cleanup(self,active=None):
        # Central maintenance needs DB authority + unchanged observations + no active locks.
        # Never delete by age, quota or disk pressure alone.
        return
    def close(self):
        for handle in self.handles.values():handle.close()
        self.handles.clear();self.lock.close()
