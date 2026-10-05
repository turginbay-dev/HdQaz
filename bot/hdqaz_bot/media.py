"""Bounded image-only upload. No video processing or backend database credentials."""
import io,os,stat,uuid,warnings
from .core import SafeError
from .ingestion import open_beneath
MAX_IMAGE=10*1024*1024

def configured():return all(os.environ.get(name) for name in ("R2_ENDPOINT_URL","R2_BUCKET","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY"))

def normalize(stream):
 from PIL import Image,ImageOps
 Image.MAX_IMAGE_PIXELS=10000000
 try:
  with warnings.catch_warnings():
   warnings.simplefilter('error',Image.DecompressionBombWarning)
   with Image.open(stream) as image:
    if image.format not in ('JPEG','PNG','WEBP') or getattr(image,'n_frames',1)!=1:raise SafeError('invalid_image')
    image.load();image=ImageOps.exif_transpose(image).convert('RGB');image.thumbnail((2560,2560));out=io.BytesIO();image.save(out,'WEBP',quality=85)
    data=out.getvalue()
    if len(data)>MAX_IMAGE:raise SafeError('invalid_image')
    return data
 except SafeError:raise
 except Exception:raise SafeError('invalid_image') from None

def upload(bot,message,kind,target,uid):
 if kind not in ('poster_url','banner_url'):raise SafeError('invalid_image')
 target=str(uuid.UUID(target));item=(message.get('photo') or [message.get('document') or {}])[-1]
 size=item.get('file_size')
 if type(size) is not int or not 0<size<=MAX_IMAGE or not item.get('file_id'):raise SafeError('invalid_image')
 if getattr(bot.c,'telegram_base','')!='http://telegram-api:8081':raise SafeError('local_api_required')
 file=bot.tg.call('getFile',{'file_id':item['file_id']});bot.guard()
 if file.get('file_size')!=size:raise SafeError('invalid_image')
 try:
  with os.fdopen(open_beneath(bot.c.telegram_root,file['file_path']),'rb') as src:
   info=os.fstat(src.fileno())
   if not stat.S_ISREG(info.st_mode) or info.st_size!=size:raise SafeError('invalid_image')
   data=normalize(src)
  import boto3
  from botocore.config import Config
  names=('R2_ENDPOINT_URL','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY')
  values=[os.environ.get(n,'') for n in names]
  if not all(values):raise SafeError('media_not_configured')
  endpoint,bucket,key,secret=values
  from urllib.parse import urlsplit
  u=urlsplit(endpoint)
  if u.scheme!='https' or not (u.hostname or '').endswith('.r2.cloudflarestorage.com') or u.username or u.password or u.query or u.fragment:raise SafeError('media_not_configured')
  client=boto3.client('s3',endpoint_url=endpoint,aws_access_key_id=key,aws_secret_access_key=secret,region_name='auto',config=Config(connect_timeout=10,read_timeout=20,retries={'max_attempts':2}))
  # Immutable revision paths prevent cache/stale-write conflicts; retries use the same object.
  path=kind.split('_')[0]+'/'+target+'/'+str(uid)+'.webp'
  client.put_object(Bucket=bucket,Key=path,Body=data,ContentType='image/webp',CacheControl='public,max-age=31536000,immutable')
  url='https://cdn.hdqaz.online/'+path
  import urllib.request
  from .core import NoRedirect
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'HDQaz-Worker/1.0 (+https://hdqaz.online)','Accept-Encoding':'identity'})
   with urllib.request.build_opener(NoRedirect()).open(req,timeout=20) as response:
    if response.status!=200 or response.read(16)!=data[:16]:raise SafeError('media_upload_failed')
  except Exception:
   try:client.delete_object(Bucket=bucket,Key=path)
   except Exception:pass
   raise SafeError('media_upload_failed') from None
  return url
 except SafeError:raise
 except Exception:raise SafeError('media_upload_failed') from None

def share(bot,actor,c):
 text=('🎬 ' if c.get('kind')=='movie' else '📺 ')+c['title']+'\n'+str(c.get('year') or '')
 if c.get('genres'):text+=' · '+', '.join(c['genres'])
 if c.get('description'):text+='\n\n'+c['description'][:600]
 if c.get('dubber_name'):text+='\n🗣 '+c['dubber_name']
 keyboard={'inline_keyboard':[[{'text':'▶️ Көру','url':c['watch_url']}]]}
 photo=c.get('poster_url') or c.get('banner_url')
 if photo:return bot.tg.call('sendPhoto',{'chat_id':actor,'photo':photo,'caption':text[:1000],'reply_markup':keyboard})
 return bot.tg.send(actor,text,keyboard['inline_keyboard'])
