"""Cloudflare R2 S3 adapter; production readiness requires full public CDN byte verification."""
import hashlib
import os
import time
import urllib.request
from .core import Failure,LeaseLost,NoRedirect,backoff,uuid
from .storage import SAFE,digest

class CheckedReader:
    def __init__(self,stream,check):self.stream,self.check=stream,check
    def read(self,size=-1):self.check();return self.stream.read(min(size,1024*1024) if size>=0 else 1024*1024)
    def seek(self,*args):return self.stream.seek(*args)
    def tell(self):return self.stream.tell()
    def __len__(self):return os.fstat(self.stream.fileno()).st_size

class R2Storage:
    remotely_verified=True
    def __init__(self,config,client=None,opener=None):
        self.config=config
        if client is None:
            import boto3
            from botocore.config import Config
            client=boto3.client('s3',endpoint_url=config.r2_endpoint,region_name='auto',
                aws_access_key_id=config.r2_access_key,aws_secret_access_key=config.r2_secret_key,
                config=Config(connect_timeout=5,read_timeout=10,retries={'total_max_attempts':1},
                    request_checksum_calculation='when_required',response_checksum_validation='when_required',
                    s3={'addressing_style':'path'}))
        self.client=client
        self.opener=opener or urllib.request.build_opener(NoRedirect())
    def retry(self,operation,check):
        for attempt in range(3):
            check()
            try:return operation()
            except LeaseLost:raise
            except Exception as exc:
                # Do not emit SDK exception strings, signed URLs, request IDs or credentials.
                status=getattr(exc,'response',{}).get('ResponseMetadata',{}).get('HTTPStatusCode',0)
                if not status:status=getattr(exc,'code',0)
                if attempt==2 or (isinstance(status,int) and 400<=status<500 and status not in {408,429}):
                    raise Failure('upload_failed') from None
                deadline=time.monotonic()+backoff(attempt,1,4)
                while time.monotonic()<deadline:check();time.sleep(0.1)
    def verify_cdn(self,url,expected_size,expected_hash,check):
        with self.opener.open(urllib.request.Request(url,headers={'Accept-Encoding':'identity','User-Agent':'HDQaz-Worker/1.0 (+https://hdqaz.online)'}),timeout=10) as response:
            if response.status!=200 or response.headers.get('Content-Encoding','identity')!='identity':raise Failure('upload_failed')
            total=0;h=hashlib.sha256();start=time.monotonic()
            while True:
                check()
                if time.monotonic()-start>300:raise Failure('upload_failed')
                chunk=response.read(1024*1024)
                if not chunk:break
                total+=len(chunk)
                if total>expected_size:raise Failure('upload_failed')
                h.update(chunk)
            if total!=expected_size or h.hexdigest()!=expected_hash:raise Failure('upload_failed')
    def upload(self,root,files,job,check,progress):
        # Independent from lease UUID: never reveal a claim credential in a release URL.
        prefix='candidates/'+uuid(job['id'])+'-'+str(int(job['attempt_count']))+'-'+os.urandom(16).hex()
        ordered=sorted(files,key=lambda p:(p.endswith('.m3u8'),p=='master.m3u8',p))
        total=sum((root/p).stat().st_size for p in files);done=0
        for name in ordered:
            check()
            if not SAFE.fullmatch(name):raise Failure('upload_failed')
            path=root/name;size=path.stat().st_size
            if not 0<size<=512*1024**2:raise Failure('upload_failed')
            checksum=digest(path,check);key=prefix+'/'+name
            def put():
                with open(path,'rb') as stream:
                    self.client.put_object(Bucket=self.config.r2_bucket,Key=key,Body=CheckedReader(stream,check),
                        ContentLength=size,ContentType='application/vnd.apple.mpegurl' if name.endswith('.m3u8') else 'video/mp2t',
                        CacheControl='public, max-age=31536000, immutable',Metadata={'sha256':checksum})
            # Repeated PUT uses the same random *new* key and same bytes; never an existing release path.
            self.retry(put,check)
            def verify():
                head=self.client.head_object(Bucket=self.config.r2_bucket,Key=key)
                if head.get('ContentLength')!=size or head.get('Metadata',{}).get('sha256')!=checksum:raise Failure('upload_failed')
                self.verify_cdn(self.config.output_origin+'/'+key,size,checksum,check)
            self.retry(verify,check)
            done+=size;progress(done/total)
        return self.config.output_origin+'/'+prefix+'/master.m3u8'
    def cleanup_partials(self):
        # Do not delete remotely: operator audits orphan candidate prefixes against retained Ready jobs.
        pass
