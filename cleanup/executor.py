"""Separate cleanup executor. No processing/Telegram/service-role credential is accepted."""
import os,json,time,uuid,urllib.request,hashlib,shutil,sqlite3
from pathlib import Path
import boto3
from botocore.config import Config
API=os.environ['HDQAZ_API_BASE_URL'].rstrip('/')+'/api/automation/cleanup'
TOKEN=os.environ['CONTENT_CLEANUP_TOKEN']
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args):return None
opener=urllib.request.build_opener(NoRedirect())
def call(body):
 req=urllib.request.Request(API,data=json.dumps(body).encode(),headers={'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'})
 with opener.open(req,timeout=300) as r:
  value=json.load(r)
  if 'data' not in value:raise RuntimeError()
  return value['data']
def owned_uuid(value):
 if str(uuid.UUID(value))!=value:raise ValueError()
 return value
class Executor:
 def __init__(self,client=None):
  self.client=client or boto3.client('s3',endpoint_url=os.environ['R2_ENDPOINT_URL'],region_name='auto',aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],config=Config(connect_timeout=5,read_timeout=15,retries={'total_max_attempts':3},request_checksum_calculation='when_required',response_checksum_validation='when_required',s3={'addressing_style':'path'}))
  self.bucket=os.environ['R2_BUCKET']
 def r2(self,prefix):
  if not prefix or prefix.startswith('/') or '..' in prefix or '%' in prefix or '\\' in prefix:raise ValueError()
  for page in self.client.get_paginator('list_objects_v2').paginate(Bucket=self.bucket,Prefix=prefix):
   keys=[{'Key':o['Key']} for o in page.get('Contents',[])]
   if any(not k['Key'].startswith(prefix) for k in keys):raise ValueError()
   if keys and self.client.delete_objects(Bucket=self.bucket,Delete={'Objects':keys,'Quiet':True}).get('Errors'):raise RuntimeError()
  if self.client.list_objects_v2(Bucket=self.bucket,Prefix=prefix,MaxKeys=1).get('KeyCount',0):raise RuntimeError()
 def busy(self,ids,refs=None):
  db=Path('/bot-state/conversation.sqlite')
  if not db.exists():return False
  with sqlite3.connect('file:'+str(db)+'?mode=ro',uri=True,timeout=5) as c:
   for (raw,) in c.execute('select data from sessions'):
    s=json.loads(raw)
    if s.get('id') in ids:
     if s.get('mode')=='ingest':return True
     ref=s.get('source_ref')
     if ref and refs is not None and ref not in refs:
      owned_uuid(ref)
      if (Path('/sources/inbox')/(ref+'.media')).exists() or (Path('/sources/inbox')/('.tg-'+ref+'.partial')).exists():return True
  return False
 def local(self,path):
  kind,value=path.split('/',1);owned_uuid(value)
  if kind=='workflow':return
  if kind=='job':
   paths=[Path('/sources')/(value+'.media')]
   for root in [Path('/work'),Path('/storage'),Path('/storage/candidates')]:
    if root.is_symlink():raise ValueError()
    if root.exists():paths.extend(p for p in root.iterdir() if p.name.startswith(value+'-'))
  elif kind=='source':paths=[Path('/sources/inbox')/(value+'.media'),Path('/sources/inbox')/('.tg-'+value+'.partial')]
  else:raise ValueError()
  for p in paths:
   if p.is_symlink() or p.parent.is_symlink():raise ValueError()
   if not p.exists():continue
   if time.time()-p.stat().st_mtime<90:raise BlockingIOError()
   if p.is_dir():
    children=list(p.rglob('*'))
    if any(c.is_symlink() for c in children):raise ValueError()
    if any(time.time()-c.stat().st_mtime<90 for c in children):raise BlockingIOError()
    shutil.rmtree(p)
   else:p.unlink()
 def execute(self,task):
  results=[];busy=self.busy(task['workflow_ids'],task.get('source_refs',[]))
  for a in task['assets']:
   result={'id':a['id'],'state':'done'}
   try:
    if a.get('shared'):result['state']='shared'
    elif a['kind']=='blocked':result.update(state='error',error='unverified_ownership')
    elif a['kind']=='image':result.update(state='error',error='storage_unavailable') # backend holds Storage credentials
    elif busy:result.update(state='error',error='local_busy')
    elif a['kind']=='r2':self.r2(a['path'])
    elif a['kind']=='local':self.local(a['path'])
    else:raise ValueError()
   except BlockingIOError:result.update(state='error',error='local_busy')
   except ValueError:result.update(state='error',error='unsafe_path')
   except Exception:result.update(state='error',error='storage_unavailable')
   results.append(result)
  return results
if __name__=='__main__':
 executor=Executor()
 while True:
  try:
   task=call({'action':'claim'})
   if task:call({'action':'report','id':task['id'],'lease_token':task['lease_token'],'results':executor.execute(task)})
   Path('/tmp/cleanup-heartbeat').touch()
  except Exception:print('Cleanup request interrupted; durable task retained.',flush=True)
  time.sleep(10)
