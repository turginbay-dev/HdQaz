import io,unittest,tempfile,os
from unittest.mock import patch
from pathlib import Path
from types import SimpleNamespace
from PIL import Image
from hdqaz_bot.media import normalize,upload,share
from hdqaz_bot.core import SafeError
class MediaTests(unittest.TestCase):
 def image(self,fmt='PNG'):
  f=io.BytesIO();Image.new('RGB',(48,32),'blue').save(f,fmt);return f.getvalue()
 def test_common_formats_become_webp(self):
  for fmt in ('PNG','JPEG','WEBP'):
   data=normalize(io.BytesIO(self.image(fmt)));self.assertEqual(Image.open(io.BytesIO(data)).format,'WEBP')
 def test_invalid_and_animated_rejected(self):
  with self.assertRaises(SafeError):normalize(io.BytesIO(b'not image'))
  f=io.BytesIO();Image.new('RGB',(2,2)).save(f,'GIF')
  with self.assertRaises(SafeError):normalize(io.BytesIO(f.getvalue()))
 def test_upload_checks_size_before_download(self):
  with self.assertRaises(SafeError):upload(object(),{'document':{'file_id':'id','file_size':20*1024*1024}},'poster_url','00000000-0000-4000-8000-000000000001',1)
 def test_photo_share_poster_banner_and_text(self):
  calls=[];tg=SimpleNamespace(call=lambda m,d:calls.append((m,d)),send=lambda a,t,b:calls.append(('send',{'text':t,'buttons':b})));b=SimpleNamespace(tg=tg)
  c={'title':'Title','year':2026,'watch_url':'https://hdqaz.online/title','poster_url':'poster','banner_url':'banner'}
  share(b,123,c);self.assertEqual(calls[-1][1]['photo'],'poster');self.assertNotIn(c['watch_url'],calls[-1][1]['caption']);c['poster_url']='';share(b,123,c);self.assertEqual(calls[-1][1]['photo'],'banner');c['banner_url']='';share(b,123,c);self.assertEqual(calls[-1][0],'send')
