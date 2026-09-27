const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./ts-loader.cjs');
const id = '11111111-1111-4111-8111-111111111111';
const episode = '22222222-2222-4222-8222-222222222222';
const key = '33333333-3333-4333-8333-333333333333';
const worker = 'synthetic-worker-test-credential-'.repeat(2);
const workerB = 'synthetic-second-worker-credential-'.repeat(2);
const producer = 'synthetic-producer-test-credential-'.repeat(2);
const admin = 'synthetic-admin-test-credential-'.repeat(2);
const env = {
  AUTOMATION_WORKER_CREDENTIALS: JSON.stringify({ worker_a: worker, worker_b: workerB }),
  AUTOMATION_PRODUCER_TOKEN: producer, AUTOMATION_OUTPUT_ORIGINS: 'https://cdn.hdqaz.online', BACKEND_ADMIN_TOKEN: admin
};
function harness(options = {}) {
  const calls = [];
  let load;
  load = loader({
    '@/lib/api/auth': { async requireAdmin(request) {
      if (request.headers.get('authorization') !== `Bearer ${admin}`) {
        const { ApiError } = load('src/lib/api/errors.ts'); throw new ApiError(403, 'forbidden', 'Admin access is required.');
      }
    } },
    '@/lib/supabase/admin': { getOptionalAdminClient() { return {
      async rpc(name, args) {
        calls.push({ name, args });
        if (options.error) return { data: null, error: options.error };
        return { data: options.empty ? [] : [{ id, content_id: id, episode_id: null, status: 'downloading',
          lease_token: key, worker_id: 'worker_a', idempotency_key: key, output_metadata: {}, error_code: null, error_message: null,
          ...options.row }], error: null };
      }
    }; } }
  }, { ...env, ...options.env });
  return { calls, load, handle: load('src/features/processing/http.ts').processingRequest };
}
function req(payload, credential = worker, extra = {}) {
  return new Request('https://hdqaz.online/api/automation/jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}), ...extra },
    body: JSON.stringify(payload)
  });
}
test('producer creates movie and episode jobs; worker cannot create', async () => {
  const h = harness();
  for (const episode_id of [null, episode]) {
    const response = await h.handle(req({ content_id: id, episode_id, idempotency_key: key }, producer), 'create');
    assert.equal(response.status, 201); assert.equal(h.calls.at(-1).args.p_episode_id, episode_id);
    assert.equal((await response.json()).data.lease_token, undefined);
  }
  assert.equal((await h.handle(req({ content_id: id, idempotency_key: key }), 'create')).status, 403);
});
test('every worker operation rejects missing/general-admin/producer credentials before touching DB', async () => {
  const h = harness();
  for (const action of ['claim','heartbeat','complete','fail']) for (const credential of [null, admin, producer, 'wrong']) {
    assert.equal((await h.handle(req({}, credential), action, id)).status, 401);
  }
  assert.equal(h.calls.length, 0);
});
test('claim uses credential-bound worker identity and returns only that claim token', async () => {
  const h = harness();
  assert.equal((await h.handle(req({ worker_id: 'worker_b' }), 'claim')).status, 400);
  const response = await h.handle(req({}), 'claim');
  assert.equal(response.status, 200); assert.equal(h.calls[0].args.p_worker_id, 'worker_a');
  const data = (await response.json()).data;
  assert.equal(data.lease_token, key); assert.equal(data.idempotency_key, undefined); assert.equal(data.worker_id, undefined);
  assert.equal((await harness({empty:true}).handle(req({}), 'claim')).status, 200);
});
test('worker/producer cannot list queue or retry; only admin retries', async () => {
  const h = harness();
  for (const credential of [worker, producer, null]) for (const action of ['list','retry']) {
    assert.equal((await h.handle(req({}, credential), action, id)).status, 403);
  }
  const response = await h.handle(req({}, admin), 'retry', id);
  assert.equal(response.status, 200); assert.equal(h.calls.at(-1).name, 'automation_retry_job');
  assert.equal((await response.json()).data.lease_token, undefined);
});
test('UUID, attempts, progress and stage validation reject bad inputs', async () => {
  const h = harness();
  for (const patch of [{content_id:'bad'}, {episode_id:'bad'}, {idempotency_key:'bad'}, {max_attempts:0}, {max_attempts:11}]) {
    assert.equal((await h.handle(req({content_id:id,idempotency_key:key,...patch},producer),'create')).status,400);
  }
  for (const progress_percent of [-1,101,0.5,'50',null]) {
    assert.equal((await h.handle(req({lease_token:key,stage:'processing',progress_percent}),'heartbeat',id)).status,400);
  }
  assert.equal((await h.handle(req({lease_token:key,stage:'ready',progress_percent:100}),'heartbeat',id)).status,400);
  assert.equal((await h.handle(req({lease_token:'bad',stage:'processing',progress_percent:50}),'heartbeat',id)).status,400);
  assert.equal((await h.handle(req({lease_token:key,stage:'processing',progress_percent:50}),'heartbeat','bad')).status,400);
  assert.equal(h.calls.length,0);
});
test('heartbeat passes owner and lease; conflicts become 409 without secret details', async () => {
  const h = harness({error:{code:'P0001',message:'secret internal stack trace',details:worker}});
  const response=await h.handle(req({lease_token:key,stage:'processing',progress_percent:40}),'heartbeat',id);
  assert.equal(response.status,409); assert.equal(h.calls[0].args.p_worker_id,'worker_a'); assert.equal(h.calls[0].args.p_lease_token,key);
  assert.doesNotMatch(await response.text(),/secret|stack|synthetic/);
});
test('complete accepts safe output and numeric metadata, rejects token URLs and arbitrary metadata', async () => {
  const h = harness();
  const input={lease_token:key,output_manifest_url:'https://cdn.hdqaz.online/jobs/a/master.m3u8',output_metadata:{duration_seconds:10.5,width:1920,height:1080,size_bytes:123}};
  assert.equal((await h.handle(req(input),'complete',id)).status,200);
  assert.equal(h.calls[0].args.p_manifest,input.output_manifest_url);
  for(const output_manifest_url of ['https://evil.example/a.m3u8','http://cdn.hdqaz.online/a.m3u8','https://cdn.hdqaz.online/a.m3u8?token=secret','https://u:p@cdn.hdqaz.online/a.m3u8','https://cdn.hdqaz.online/a.m3u8#token','https://cdn.hdqaz.online/a.mp4','https://cdn.hdqaz.online/../a.m3u8','https://cdn.hdqaz.online/a%2Fb.m3u8']) {
    assert.equal((await h.handle(req({...input,output_manifest_url}),'complete',id)).status,400);
  }
  for (const output_metadata of [{stack:'secret'},{width:'1920'},{duration_seconds:-1},{height:1.5},{size_bytes:1e20}]) {
    assert.equal((await h.handle(req({...input,output_metadata}),'complete',id)).status,400);
  }
  assert.equal((await harness({env:{AUTOMATION_OUTPUT_ORIGINS:''}}).handle(req(input),'complete',id)).status,503);
});
test('fail stores allowlisted code only and never accepts logs, messages or reserved lease_expired', async () => {
  const h=harness();
  assert.equal((await h.handle(req({lease_token:key,error_code:'processing_failed'}),'fail',id)).status,200);
  for (const patch of [{error_message:'secret'},{stack:'secret'},{error_code:'lease_expired'},{error_code:'unknown'}]) {
    assert.equal((await h.handle(req({lease_token:key,error_code:'processing_failed',...patch}),'fail',id)).status,400);
  }
  assert.equal(h.calls.length,1); assert.equal(h.calls[0].args.p_error_code,'processing_failed');
});
test('DB target/duplicate failures are sanitized 400/409; internal failures are 503', async () => {
  for (const [code,status] of [['23503',400],['23514',400],['23505',409],['XX000',503]]) {
    const h=harness({error:{code,message:'service_role SECRET'}});
    const r=await h.handle(req({content_id:id,idempotency_key:key},producer),'create');
    assert.equal(r.status,status); assert.doesNotMatch(await r.text(),/SECRET|service_role/);
  }
});
test('oversized input, unknown fields, cross-site mutation and unsafe credential reuse fail closed', async () => {
  const h=harness();
  assert.equal((await h.handle(req({payload:'a'.repeat(17000)}),'claim')).status,413);
  assert.equal((await h.handle(req({},worker,{Origin:'https://evil.example'}),'claim')).status,403);
  const reused=harness({env:{AUTOMATION_WORKER_CREDENTIALS:JSON.stringify({worker_a:admin})}});
  assert.equal((await reused.handle(req({},admin),'claim')).status,503);
  const duplicated=harness({env:{AUTOMATION_WORKER_CREDENTIALS:JSON.stringify({a:worker,b:worker})}});
  assert.equal((await duplicated.handle(req({}),'claim')).status,503);
  assert.equal(h.calls.length,0);
});
test('Next route adapters expose only allowed actions',async()=>{
  const h=harness();
  const route=h.load('src/app/api/automation/jobs/[jobId]/[action]/route.ts');
  const r=await route.POST(req({}),{params:Promise.resolve({jobId:id,action:'create'})});
  assert.equal(r.status,404); assert.equal(h.calls.length,0);
  assert.equal((await h.load('src/app/api/automation/jobs/claim/route.ts').POST(req({}))).status,200);
});
