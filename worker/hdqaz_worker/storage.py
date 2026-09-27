from __future__ import annotations
import hashlib
import json
import os
import re
import shutil
import time
from pathlib import Path
from typing import Protocol
from .core import Failure, LeaseLost, backoff, uuid
from .workspace import exclusive_copy, regular

SAFE = re.compile(r'^(?:[0-9]+/)?(?:master\.m3u8|index\.m3u8|segment_[0-9]{6}\.ts)$')

def playlist(path):
    regular(path)
    if path.stat().st_size>2*1024*1024: raise Failure('processing_failed')
    lines=path.read_text(encoding='utf-8').splitlines()
    if not lines or lines[0]!='#EXTM3U': raise Failure('processing_failed')
    return lines

def package_files(root,expected):
    master=playlist(root/'master.m3u8')
    variants=[line for line in master if line and not line.startswith('#')]
    declarations=[line for line in master if line.startswith('#EXT-X-STREAM-INF:')]
    if not variants or len(variants)!=len(declarations) or len(variants)!=len(set(variants)) or len(variants)>2:
        raise Failure('processing_failed')
    files=['master.m3u8']
    for variant in variants:
        if not re.fullmatch(r'[0-9]+/index\.m3u8',variant): raise Failure('processing_failed')
        lines=playlist(root/variant)
        if '#EXT-X-ENDLIST' not in lines or '#EXT-X-PLAYLIST-TYPE:VOD' not in lines: raise Failure('processing_failed')
        segments=[]; durations=[];pending=False
        for line in lines:
            if line.startswith(('#EXT-X-KEY','#EXT-X-MAP','#EXT-X-BYTERANGE','#EXT-X-DISCONTINUITY')): raise Failure('processing_failed')
            if line.startswith('#EXTINF:'):
                if pending: raise Failure('processing_failed')
                try:d=float(line.split(':')[1].split(',')[0])
                except ValueError: raise Failure('processing_failed') from None
                if not 0<d<=12: raise Failure('processing_failed')
                durations.append(d);pending=True
            elif line and not line.startswith('#'):
                if not pending or not re.fullmatch(r'segment_[0-9]{6}\.ts',line): raise Failure('processing_failed')
                path=str(Path(variant).parent/line)
                regular(root/path)
                if (root/path).stat().st_size==0: raise Failure('processing_failed')
                segments.append(path);pending=False
        if pending or not segments or len(set(segments))!=len(segments) or abs(sum(durations)-expected)>max(1,expected*0.02):
            raise Failure('processing_failed')
        files += [variant,*segments]
    actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
    if actual!=set(files) or any(p.is_symlink() for p in root.rglob('*')): raise Failure('processing_failed')
    return files,variants

def verify_local(root,expected,runner,variants):
    files,playlists=package_files(root,expected)
    if len(playlists)!=len(variants): raise Failure('processing_failed')
    for name,rendition in zip(playlists,variants):
        # Inspect and fully decode every output variant, not just an exit code or first segment.
        meta=runner.probe(root/name)
        if (meta.width,meta.height)!=(rendition.width,rendition.height) or abs(meta.duration-expected)>max(1,expected*0.02):
            raise Failure('processing_failed')
        runner.decode(root/name,expected)
    return files

def digest(path,check):
    h=hashlib.sha256()
    with open(path,'rb') as stream:
        while chunk:=stream.read(1024*1024): check();h.update(chunk)
    return h.hexdigest()

class Storage(Protocol):
    def upload(self,root:Path,files:list[str],job:dict,check,progress) -> str: ...

class LocalStorage:
    """Safe local/mock adapter. Does not claim that a Cloudflare endpoint was verified."""
    remotely_verified=False
    def __init__(self,config): self.config=config
    def upload(self,root,files,job,check,progress):
        prefix=uuid(job['id'])+'-'+str(int(job['attempt_count']))+'-'+os.urandom(12).hex()
        store=self.config.storage
        store.mkdir(parents=True,exist_ok=True,mode=0o700)
        staging=store/('.partial-'+prefix);release=store/prefix
        staging.mkdir(mode=0o700)
        total=sum((root/name).stat().st_size for name in files);done=0
        try:
            # Segments first, variants next, master last. Final rename exposes one verified package.
            ordered=sorted(files,key=lambda p:(p.endswith('.m3u8'),p=='master.m3u8',p))
            for name in ordered:
                check()
                if not SAFE.fullmatch(name): raise Failure('upload_failed')
                destination=staging/name;destination.parent.mkdir(exist_ok=True)
                for attempt in range(3):
                    try:
                        exclusive_copy(root/name,destination,(root/name).stat().st_size,check,
                            lambda p:progress((done+p*(root/name).stat().st_size)/total),
                            self.config.source_timeout,self.config.min_free)
                        break
                    except OSError:
                        destination.unlink(missing_ok=True)
                        if attempt==2: raise
                        until=time.monotonic()+backoff(attempt,1,4)
                        while time.monotonic()<until: check();time.sleep(0.1)
                if digest(root/name,check)!=digest(destination,check): raise Failure('upload_failed')
                done+=(root/name).stat().st_size
            # Parsed again at destination; actual bytes verified, not only names or counts.
            expected=sum(float(s.split(':')[1].split(',')[0]) for s in playlist(staging/next(p for p in files if p.endswith('/index.m3u8'))) if s.startswith('#EXTINF:'))
            package_files(staging,expected)
            check()
            if release.exists(): raise Failure('upload_failed')
            os.rename(staging,release)
            fd=os.open(store,os.O_RDONLY)
            try:os.fsync(fd)
            finally:os.close(fd)
            return self.config.output_origin+'/'+prefix+'/master.m3u8'
        except LeaseLost: raise
        except (OSError,ValueError,Failure): raise Failure('upload_failed') from None
        finally:
            # Only our newly created private partial path; no final releases are removed here.
            if staging.exists() and not staging.is_symlink(): shutil.rmtree(staging)
    def cleanup_partials(self):
        # Each instance needs a distinct storage root for this local adapter.
        if not self.config.storage.exists(): return
        for p in self.config.storage.iterdir():
            if re.fullmatch(r'\.partial-[0-9a-f-]{36}-[0-9]+-[0-9a-f]{24}',p.name) and p.is_dir() and not p.is_symlink():
                if time.time()-p.stat().st_mtime>self.config.process_timeout+3600: shutil.rmtree(p)
