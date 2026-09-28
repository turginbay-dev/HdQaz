import contextlib
import hashlib
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import threading
import unittest
from dataclasses import replace
from unittest.mock import patch
from hdqaz_worker.core import Failure,LeaseLost
from hdqaz_worker.r2 import R2Storage
from test_worker import config,JOB

class R2Tests(unittest.TestCase):
    def test_sdk_http_put_retry_head_and_cdn_verification(self):
        import boto3
        from botocore.config import Config as SDKConfig
        objects={};state={'fail':True,'order':[],'corrupt':False}
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*_):pass
            def do_PUT(self):
                n=int(self.headers['Content-Length']);body=self.rfile.read(n)
                if state['fail']:
                    state['fail']=False;self.send_response(503);self.end_headers();return
                objects[self.path]=(body,self.headers.get('x-amz-meta-sha256'),self.headers.get('Content-Type'))
                state['order'].append(self.path);self.send_response(200);self.send_header('ETag','"test"');self.end_headers()
            def do_HEAD(self):
                body,sha,kind=objects[self.path]
                self.send_response(200);self.send_header('Content-Length',str(len(body)));self.send_header('x-amz-meta-sha256',sha);self.end_headers()
            def do_GET(self):
                # Model the production BIC rejection without relaxing CDN verification.
                if self.headers.get('User-Agent') != 'HDQaz-Worker/1.0 (+https://hdqaz.online)':
                    self.send_response(403);self.end_headers();return
                body,sha,kind=objects['/test-bucket'+self.path]
                self.send_response(200);self.send_header('Content-Length',str(len(body)));self.end_headers()
                self.wfile.write(b'X'*len(body) if state['corrupt'] else body)
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            endpoint='http://127.0.0.1:'+str(server.server_port)
            with tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp);c=replace(config(root),r2_bucket='test-bucket',output_origin=endpoint)
                client=boto3.client('s3',endpoint_url=endpoint,region_name='auto',aws_access_key_id='test-only',aws_secret_access_key='test-only',
                    config=SDKConfig(retries={'total_max_attempts':1},request_checksum_calculation='when_required',response_checksum_validation='when_required',s3={'addressing_style':'path'}))
                storage=R2Storage(c,client=client)
                (root/'0').mkdir();(root/'0/segment_000000.ts').write_bytes(b'synthetic segment'*1000)
                (root/'0/index.m3u8').write_text('#EXTM3U\nsegment_000000.ts\n');(root/'master.m3u8').write_text('#EXTM3U\n0/index.m3u8\n')
                with patch('hdqaz_worker.r2.backoff',return_value=0):
                    url=storage.upload(root,['master.m3u8','0/index.m3u8','0/segment_000000.ts'],JOB,lambda:None,lambda _:None)
                self.assertTrue(url.endswith('/master.m3u8'));self.assertEqual(len(objects),3)
                self.assertTrue(state['order'][-1].endswith('/master.m3u8'))
                self.assertEqual(objects[state['order'][0]][2],'video/mp2t')
                self.assertEqual(objects[state['order'][-1]][2],'application/vnd.apple.mpegurl')
                state['corrupt']=True
                with self.assertRaises(Failure):storage.verify_cdn(url,(root/'master.m3u8').stat().st_size,hashlib.sha256((root/'master.m3u8').read_bytes()).hexdigest(),lambda:None)
        finally:server.shutdown();server.server_close();thread.join()
    def test_upload_aborts_when_lease_lost(self):
        class Client:
            def put_object(self,**kwargs):raise AssertionError('must not upload')
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'master.m3u8').write_text('test');storage=R2Storage(config(root),client=Client())
            def lost():raise LeaseLost()
            with self.assertRaises(LeaseLost):storage.upload(root,['master.m3u8'],JOB,lost,lambda _:None)
    def test_no_retry_on_access_denied(self):
        class Denied(Exception):response={'ResponseMetadata':{'HTTPStatusCode':403}}
        storage=R2Storage(config(Path('/tmp')),client=object());calls=[]
        def op():calls.append(1);raise Denied()
        with self.assertRaises(Failure):storage.retry(op,lambda:None)
        self.assertEqual(len(calls),1)
