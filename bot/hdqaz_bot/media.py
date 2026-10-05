"""Bounded image-only upload. No video processing or backend database credentials."""
import io,os,stat,uuid,warnings,urllib.request,json
from .core import NoRedirect,request_key
from .core import SafeError
from .ingestion import open_beneath
MAX_IMAGE=10*1024*1024

def configured():return True

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
    if len(data)>2*1024*1024:raise SafeError('invalid_image')
    return data
 except SafeError:raise
 except Exception:raise SafeError('invalid_image') from None

def upload(bot,message,kind,target,uid,actor=None,state=None):
 if kind not in ('poster_url','banner_url'):raise SafeError('invalid_image')
 target=str(uuid.UUID(target));item=(message.get('photo') or [message.get('document') or message.get('sticker') or {}])[-1]
 if item.get('is_animated') or item.get('is_video'):raise SafeError('invalid_image')
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
  state=state or {};actor=actor or message.get('from',{}).get('id')
  if not actor:raise SafeError('invalid_image')
  headers={'Content-Type':'image/webp','Authorization':'Bearer '+bot.c.backend,'X-Telegram-User-Id':str(actor),'X-Target-Id':target,'X-Media-Field':kind,'X-Workflow':'true' if state.get('workflow') else 'false','X-Version':str(state.get('revision') if state.get('workflow') else state.get('expected','')),'X-Request-Id':request_key(actor,uid,'media')}
  req=urllib.request.Request(bot.c.api+'/api/telegram/media',data=data,headers=headers,method='POST')
  with urllib.request.build_opener(NoRedirect()).open(req,timeout=40) as response:
   result=json.loads(response.read(32768));return result['data']['url']

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
