"""Copy completed local Bot API media into the existing immutable SourceProvider inbox.

Only the private local API may provide paths. Never log them (they can contain a token).
The Telegram API downloads; this module does no transcoding and uses bounded memory.
"""
import os
import shutil
import stat
import time
import uuid
from pathlib import Path
from .core import SafeError


def open_beneath(root, path):
    root=Path(root);path=Path(path)
    try:parts=path.relative_to(root).parts
    except ValueError:raise SafeError('invalid_source') from None
    if not parts or any(x in ('..','.') for x in parts):raise SafeError('invalid_source')
    fd=os.open(root,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        for part in parts[:-1]:
            child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
            os.close(fd);fd=child
        return os.open(parts[-1],os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd)
    finally:os.close(fd)


def media_header(data):
    # MVP supports MP4/MOV and Matroska/WebM. FFprobe/decode remains the worker's job.
    return (len(data)>=12 and data[4:8]==b'ftyp') or data[:4]==b'\x1aE\xdf\xa3'


def stage_local(root, source, inbox, reference, expected_size, limit, check=lambda:None,
                timeout=3600, reserve=2*1024**3):
    """Atomic, bounded copy; never trust a Telegram filename or overwrite an existing source."""
    if type(expected_size) is not int or not 0<expected_size<=limit:raise SafeError('invalid_source')
    inbox=Path(inbox)
    target=inbox/(str(uuid.UUID(reference))+'.media')
    partial=inbox/('.tg-'+str(uuid.UUID(reference))+'.partial')
    if inbox.is_symlink() or not inbox.is_dir():raise SafeError('invalid_source')
    start=time.monotonic()
    # Caller holds the single bot lease. Remove only this upload's interrupted temporary file.
    if partial.exists() or partial.is_symlink():
        info=partial.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.getuid():raise SafeError('invalid_source')
        partial.unlink()
    try:
        with os.fdopen(open_beneath(root,source),'rb') as src:
            before=os.fstat(src.fileno())
            if not stat.S_ISREG(before.st_mode) or before.st_size!=expected_size:raise SafeError('invalid_source')
            if not media_header(src.read(16)):raise SafeError('invalid_media')
            src.seek(0)
            if shutil.disk_usage(inbox).free<expected_size+reserve:raise SafeError('storage_full')
            with open(partial,'xb') as out:
                os.chmod(partial,0o600);total=0
                while True:
                    check()
                    if time.monotonic()-start>timeout:raise SafeError('download_timeout')
                    block=src.read(1024*1024)
                    if not block:break
                    total+=len(block)
                    if total>expected_size:raise SafeError('source_changed')
                    if shutil.disk_usage(inbox).free<len(block)+reserve:raise SafeError('storage_full')
                    out.write(block)
                after=os.fstat(src.fileno())
                if total!=expected_size or (before.st_size,before.st_mtime_ns)!=(after.st_size,after.st_mtime_ns):raise SafeError('source_changed')
                out.flush();os.fsync(out.fileno());os.fchmod(out.fileno(),0o444)
            check()
            # Link publishes the complete inode atomically and refuses existing destinations.
            os.link(partial,target,follow_symlinks=False)
            directory=os.open(inbox,os.O_RDONLY|os.O_DIRECTORY)
            try:os.fsync(directory)
            finally:os.close(directory)
            return target
    except OSError:raise SafeError('source_io') from None
    finally:
        try:partial.unlink()
        except FileNotFoundError:pass
