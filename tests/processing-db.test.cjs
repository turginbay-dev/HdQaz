// Real, disposable local PostgreSQL only. Never reads DATABASE_URL / production credentials.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { randomUUID, randomBytes } = require('node:crypto');
const { pathToFileURL } = require('node:url');
let server, db;
const movie = '11111111-1111-4111-8111-111111111111';
const series = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const episode = '44444444-4444-4444-8444-444444444444';
const tools = process.env.HDQAZ_TEST_TOOLS || process.cwd();
async function newClient() { const client = server.getPgClient(); await client.connect(); return client; }
async function rpc(name, args, client = db) {
  const argsSql = args.map((_, i) => `$${i+1}`).join(',');
  return (await client.query(`select * from public.${name}(${argsSql})`, args)).rows;
}
const create = (content = movie, ep = null, key = randomUUID(), max = 3, client = db) => rpc('automation_create_job',[content,ep,key,max],client).then(rows=>rows[0]);
const claim = (worker = 'worker_a', client = db) => rpc('automation_claim_job',[worker],client).then(rows=>rows[0]);
const update = (job, action, stage = null, progress = null, manifest = null, metadata = {}, code = null, worker = 'worker_a', client = db) =>
  rpc('automation_update_job',[job.id,worker,job.lease_token,action,stage,progress,manifest,metadata,code],client).then(rows=>rows[0]);
const rejected = (promise, code) => assert.rejects(promise, error => error.code === code);
before(async () => {
  const modulePath = require.resolve('embedded-postgres', { paths: [tools] });
  const EmbeddedPostgres = (await import(pathToFileURL(modulePath).href)).default;
  const port = await new Promise((resolve, reject) => {
    const listener = net.createServer(); listener.on('error',reject);
    listener.listen(0,'127.0.0.1',()=> { const port = listener.address().port; listener.close(()=>resolve(port)); });
  });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'hdqaz-phase2-db-'));
  server = new EmbeddedPostgres({ databaseDir: directory, user:'postgres', password:randomBytes(24).toString('hex'), port,
    persistent:false, onLog:()=>{}, onError:()=>{} });
  await server.initialise(); await server.start();
  db = await newClient();
  await db.query(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to service_role;
    alter default privileges in schema public grant all on tables to service_role;
    alter default privileges in schema public grant all on sequences to service_role;`);
  for (const file of ['202605120001_content_architecture.sql','202609260001_automation_foundation.sql','202609260002_processing_contract.sql']) {
    await db.query(await fs.readFile(path.join('supabase/migrations',file),'utf8'));
  }
  await db.query(await fs.readFile('tests/automation-foundation.sql','utf8'));
});
after(async()=> { if(db) await db.end(); if(server) await server.stop(); });
beforeEach(async()=> {
  // This database was created exclusively by this test process.
  await db.query(`truncate public.processing_jobs,public.episodes,public.seasons,public.contents cascade;
    insert into public.contents(id,title,slug,type,year,hls_url) values
      ('${movie}','movie','movie','movie',2026,'https://cdn.hdqaz.online/original.m3u8'),
      ('${series}','series','series','series',2026,null),
      ('${other}','other','other','series',2026,null);
    insert into public.episodes(id,content_id,episode_number,slug) values('${episode}','${series}',1,'legacy-one');`);
});
test('movie + episode create, idempotent replay, target validation and active duplicates', async()=> {
  const key=randomUUID(); const first=await create(movie,null,key);
  assert.equal(first.status,'queued'); assert.equal(first.attempt_count,0);
  assert.equal((await create(movie,null,key)).id,first.id);
  assert.equal((await create(series,episode)).episode_id,episode);
  await rejected(create(),'23505');
  await rejected(create(series),'23514');
  await rejected(create(movie,episode),'23514');
  // Avoid the existing active episode index masking the composite FK check.
  await db.query('delete from public.processing_jobs where episode_id=$1',[episode]);
  await rejected(create(other,episode),'23503');
  await rejected(create(randomUUID()),'23503');
  await rejected(create(other,null,key),'23514');
  await rejected(create(movie,null,randomUUID(),11),'22023');
});
test('concurrent duplicate create admits exactly one active job', async()=> {
  const b=await newClient();
  try {
    const results=await Promise.allSettled([create(),create(movie,null,randomUUID(),3,b)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.find(r=>r.status==='rejected').reason.code,'23505');
  } finally { await b.end(); }
});
test('two simultaneous workers never claim the same job', async()=> {
  const first=await create(); await create(series,episode);
  const b=await newClient();
  try {
    const jobs=await Promise.all([claim('worker_a'),claim('worker_b',b)]);
    assert.equal(new Set(jobs.map(j=>j.id)).size,2);
    assert.ok(jobs.some(j=>j.id===first.id));
    assert.equal(new Set(jobs.map(j=>j.lease_token)).size,2);
    assert.ok(jobs.every(j=>j.attempt_count===1));
    assert.equal(await claim(),undefined);
  } finally { await b.end(); }
});
test('SKIP LOCKED skips a job held by another transaction without waiting',async()=> {
  const first=await create(); const second=await create(series,episode);
  const locker=await newClient(); const b=await newClient();
  try {
    await locker.query('begin'); await locker.query('select id from public.processing_jobs where id=$1 for update',[first.id]);
    await b.query("set statement_timeout='1500ms'");
    assert.equal((await claim('worker_b',b)).id,second.id);
  } finally { await locker.query('rollback'); await locker.end(); await b.end(); }
  assert.equal((await claim()).id,first.id);
});
test('one available job is returned to only one concurrent worker',async()=> {
  await create(); const b=await newClient();
  try {
    const jobs=await Promise.all([claim('worker_a'),claim('worker_b',b)]);
    assert.equal(jobs.filter(Boolean).length,1);
  } finally { await b.end(); }
});
test('heartbeat validates monotone progress/stages and binds owner + per-claim lease',async()=> {
  await create(); const job=await claim();
  await rejected(update(job,'heartbeat','processing',40,null,{},null,'worker_b'),'P0001');
  await rejected(update({...job,lease_token:randomUUID()},'heartbeat','processing',40),'P0001');
  await rejected(update({...job,id:randomUUID()},'heartbeat','processing',40),'P0001');
  await rejected(update(job,'heartbeat','uploading',40),'22023');
  const next=await update(job,'heartbeat','processing',40);
  assert.equal(next.status,'processing'); assert.equal(next.progress_percent,40);
  assert.ok(next.lease_expires_at>=job.lease_expires_at);
  for(const progress of [-1,101,39]) await rejected(update(job,'heartbeat','processing',progress),'22023');
  await rejected(update(job,'heartbeat','downloading',50),'22023');
});
test('completion records ready output + metadata, never changes catalog video or publication',async()=> {
  const before=(await db.query('select to_jsonb(c) as data from public.contents c where id=$1',[movie])).rows[0].data;
  await create(); const job=await claim();
  const url='https://cdn.hdqaz.online/jobs/result/master.m3u8';
  await rejected(update(job,'complete',null,null,url),'22023');
  await update(job,'heartbeat','processing',50); await update(job,'heartbeat','uploading',90);
  await rejected(update(job,'complete',null,null,url+'?token=secret'),'22023');
  await rejected(update(job,'complete',null,null,url,{stack:'secret'}),'22023');
  const ready=await update(job,'complete',null,null,url,{duration_seconds:32.5,width:1920});
  assert.equal(ready.status,'ready'); assert.equal(ready.progress_percent,100); assert.equal(ready.output_manifest_url,url);
  assert.equal(ready.output_metadata.width,1920); assert.ok(ready.finished_at);
  assert.equal((await update(job,'complete',null,null,url,{duration_seconds:32.5,width:1920})).id,job.id);
  await rejected(update(job,'complete',null,null,'https://cdn.hdqaz.online/changed.m3u8'),'P0001');
  const after=(await db.query('select to_jsonb(c) as data from public.contents c where id=$1',[movie])).rows[0].data;
  assert.deepEqual(after,before);
});
test('episode output also stays review-only',async()=> {
  const before=(await db.query('select to_jsonb(e) as data from public.episodes e where id=$1',[episode])).rows[0].data;
  await create(series,episode); const job=await claim();
  await update(job,'heartbeat','processing',40); await update(job,'heartbeat','uploading',90);
  await update(job,'complete',null,null,'https://cdn.hdqaz.online/episode/master.m3u8');
  assert.deepEqual((await db.query('select to_jsonb(e) as data from public.episodes e where id=$1',[episode])).rows[0].data,before);
});
test('fail is sanitized; retry preserves attempts, backoff, fences old lease and enforces max',async()=> {
  await create(movie,null,randomUUID(),2); const job=await claim();
  const failed=await update(job,'fail',null,null,null,{},'processing_failed');
  assert.equal(failed.status,'failed'); assert.equal(failed.error_message,'Video processing failed.'); assert.ok(failed.finished_at);
  assert.equal((await update(job,'fail',null,null,null,{},'processing_failed')).id,job.id);
  const queued=(await rpc('automation_retry_job',[job.id]))[0];
  assert.equal(queued.attempt_count,1); assert.equal(queued.status,'queued'); assert.equal(queued.lease_token,null);
  assert.ok(queued.next_attempt_at>new Date()); assert.equal(await claim(),undefined);
  await rejected(update(job,'heartbeat','processing',40),'P0001');
  await db.query("update public.processing_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[job.id]);
  const second=await claim(); assert.equal(second.attempt_count,2); assert.notEqual(second.lease_token,job.lease_token);
  await update(second,'fail',null,null,null,{},'internal_error');
  await rejected(rpc('automation_retry_job',[job.id]),'P0001'); assert.equal(await claim(),undefined);
});
test('expired lease cannot update/complete/fail and reclaim rotates token',async()=> {
  await create(); const job=await claim();
  await db.query("update public.processing_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1",[job.id]);
  await rejected(update(job,'heartbeat','processing',20),'P0001');
  await rejected(update(job,'complete',null,null,'https://cdn.hdqaz.online/a.m3u8'),'P0001');
  await rejected(update(job,'fail',null,null,null,{},'internal_error'),'P0001');
  const reclaimed=await claim('worker_b'); assert.equal(reclaimed.id,job.id); assert.equal(reclaimed.attempt_count,2);
  assert.notEqual(reclaimed.lease_token,job.lease_token);
  await rejected(update(job,'heartbeat','processing',20),'P0001');
});
test('expired last attempt is failed with safe lease_expired and never reclaimed',async()=> {
  await create(movie,null,randomUUID(),1); const job=await claim();
  await db.query("update public.processing_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1",[job.id]);
  assert.equal(await claim(),undefined);
  const failed=(await db.query('select * from public.processing_jobs where id=$1',[job.id])).rows[0];
  assert.equal(failed.status,'failed'); assert.equal(failed.error_code,'lease_expired'); assert.equal(failed.lease_token,null);
  await rejected(rpc('automation_retry_job',[job.id]),'P0001');
});
test('retry cannot conflict with another active job for same target',async()=> {
  await create(); const job=await claim(); await update(job,'fail',null,null,null,{},'internal_error');
  await create(); await rejected(rpc('automation_retry_job',[job.id]),'23505');
});
test('public/anon/authenticated cannot call RPCs or read queue; service role can claim',async()=> {
  for(const role of ['anon','authenticated']) {
    await db.query(`set role ${role}`);
    try {
      await rejected(db.query('select * from public.processing_jobs'),'42501');
      await rejected(claim(),'42501');
      await rejected(create(),'42501');
      await rejected(rpc('automation_retry_job',[randomUUID()]),'42501');
      await rejected(rpc('automation_update_job',[randomUUID(),'worker_a',randomUUID(),'fail',null,null,null,{},'internal_error']),'42501');
    } finally { await db.query('reset role'); }
  }
  await db.query('set role service_role');
  try { const job=await create(); assert.equal((await claim()).id,job.id); } finally { await db.query('reset role'); }
});
