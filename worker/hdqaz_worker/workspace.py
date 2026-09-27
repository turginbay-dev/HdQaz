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
    def __init__(self,config): self.config=config
    def acquire(self,job,destination,check,progress):
        source=self.config.sources/(uuid(job['id'])+'.media')
        try:
            regular(source)
            disk(destination.parent,source.stat().st_size,self.config.min_free)
            exclusive_copy(source,destination,self.config.max_source,check,progress,
                self.config.source_timeout,self.config.min_free)
            return destination
        except LeaseLost: raise
        except Failure as exc:
            if exc.code=='processing_failed': raise
            raise Failure('download_failed') from None
        except OSError: raise Failure('download_failed') from None

class Workspaces:
    def __init__(self,config):
        self.config=config
        self.root=config.workspace
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
        (path/MARKER).write_text('v1')
        return path
    def remove(self,path):
        # Never follow symlinks or permit callers to remove root/ancestors/foreign paths.
        if path.parent!=self.root or path.is_symlink() or not path.is_dir() or not (path/MARKER).is_file() or (path/MARKER).is_symlink():
            raise Failure()
        if not shutil.rmtree.avoids_symlink_attacks: raise Failure()
        shutil.rmtree(path)
    def cleanup(self,active=None):
        candidates=[]
        for p in self.root.iterdir():
            if p==active or p.is_symlink() or not p.is_dir() or not (p/MARKER).is_file() or (p/MARKER).is_symlink(): continue
            size=sum(f.lstat().st_size for f in p.rglob('*') if f.is_file() and not f.is_symlink())
            candidates.append((p.stat().st_mtime,p,size))
        total=sum(x[2] for x in candidates)
        for modified,p,size in sorted(candidates):
            if time.time()-modified>self.config.retention_seconds or total>self.config.retention_bytes or shutil.disk_usage(self.root).free<self.config.min_free:
                self.remove(p);total-=size
    def close(self): self.lock.close()
