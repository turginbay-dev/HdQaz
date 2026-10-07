"""Bounded non-secret coordination between the existing worker, bot and cleanup service."""
import json,os,shutil,time
from pathlib import Path

def root():
    value=os.environ.get('WORKER_CONTROL_ROOT')
    if not value:return None
    p=Path(value)
    if not p.is_absolute() or p.is_symlink() or not p.is_dir():raise ValueError('control_unavailable')
    return p

def write(name,value):
    p=root()
    if p is None:return
    target=p/name;tmp=p/(name+'.tmp-worker')
    fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'w') as f:json.dump(value,f);f.flush();os.fsync(f.fileno())
    os.replace(tmp,target)

def can_claim(workspace):
    p=root()
    if p is None:return True
    d=shutil.disk_usage(workspace)
    if (d.total-d.free)*100/d.total>=int(os.environ.get('DISK_CRITICAL_PERCENT') or 90):return False
    try:
        state=json.loads((p/'storage.json').read_text())
        return time.time()-state['timestamp']<180 and not state['claiming_paused']
    except (OSError,ValueError,KeyError):return False
