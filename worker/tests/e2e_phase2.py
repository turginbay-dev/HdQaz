"""Run only on Linux: actual Phase 2 HTTP handlers / disposable PG via loopback test bridge."""
import json
import platform
import shutil
import tempfile
import urllib.request
import uuid
from dataclasses import replace
from pathlib import Path
from hdqaz_worker.core import Api
from hdqaz_worker.main import Worker
from test_media import MediaTests
from test_worker import config

assert platform.system()=='Linux','Media tests must not run on Mac'
base='http://127.0.0.1:18440'
admin='integration-only-admin-credential-not-for-production'
def request(path,payload=None):
    req=urllib.request.Request(base+path,data=None if payload is None else json.dumps(payload).encode(),
        headers={'Authorization':'Bearer '+admin,'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=15) as r:return json.load(r)
MediaTests.setUpClass()
try:
    c=replace(MediaTests.c,api=base,token='integration-only-worker-credential-not-for-production',max_source=10*1024**2)
    created=request('/api/automation/jobs',{'content_id':'11111111-1111-4111-8111-111111111111','idempotency_key':str(uuid.uuid4())})['data']
    assert created['status']=='queued'
    shutil.copyfile(MediaTests.video,c.sources/(created['id']+'.media'))
    api=Api(c);job=api.claim();assert job['id']==created['id'];assert api.claim() is None
    worker=Worker(c,api=api)
    try:assert worker.process(job,allow_local_complete=True)
    finally:worker.close()
    queue=request('/api/automation/jobs')['data']['items'];ready=next(j for j in queue if j['id']==job['id'])
    assert ready['status']=='ready' and ready['progress_percent']==100
    assert ready['output_metadata']['height']==720 and ready['output_manifest_url'].endswith('/master.m3u8')
    assert 'lease_token' not in ready and request('/test/assert-catalog')['unchanged']
    assert not list(c.workspace.glob('*/source.media'))
    print(json.dumps({'result':'PASS','flow':'admin create -> real Phase2 claim/heartbeat -> FFmpeg branding/HLS -> local upload+verify -> real PostgreSQL ready -> admin list',
        'catalog_unchanged':True,'cleanup':True,'storage':'local mock; not real R2','height':ready['output_metadata']['height']}))
finally:MediaTests.tearDownClass()
