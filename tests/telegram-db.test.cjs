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
  await db.query('alter table public.contents add column is_premium boolean not null default false');
  await db.query(await fs.readFile('supabase/migrations/202609290001_telegram_workflow.sql','utf8'));
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

const action=async (op,w,data={},actor=123,key=randomUUID())=>(await rpc('telegram_workflow_action',[actor,key,op,w?.id||null,w?.revision??null,data]))[0].telegram_workflow_action;
const draft=async(kind='movie')=>{let w=await action('new',null,{kind});return action('edit',w,{title:'Phase 4 test',year:2026,tmdb_id:900001,...(kind==='series'?{season_number:1,episode_number:1}:{})});};
const prepare=async(kind='movie')=>action('prepare',await draft(kind),{source_ref:randomUUID()});
const ready=async(kind='movie')=>{let w=await prepare(kind);w=await action('activate',w);const j=await claim();await update(j,'heartbeat','processing',20);await update(j,'heartbeat','uploading',90);await update(j,'complete',null,null,'https://cdn.hdqaz.online/candidates/test/master.m3u8',{duration_seconds:10});return w;};
const publish=w=>action('publish',w,{manifest_url:'https://cdn.hdqaz.online/candidates/test/master.m3u8'});
test('movie draft uses Phase 2 creation and held source cannot be claimed',async()=>{const w=await prepare();assert.equal(w.state,'staging');assert.equal(await claim(),undefined);const c=(await db.query('select * from contents where id=$1',[w.content_id])).rows[0];assert.equal(c.hls_url,null);assert.equal(c.is_published,false);await action('activate',w);assert.equal((await claim()).id,w.job_id);});
test('Ready never publishes; explicit publish atomically attaches output, audit and outbox',async()=>{const w=await ready();let c=(await db.query('select * from contents where id=$1',[w.content_id])).rows[0];assert.equal(c.is_published,false);assert.equal((await db.query('select count(*) from telegram_channel_posts')).rows[0].count,'0');await publish(w);c=(await db.query('select * from contents where id=$1',[w.content_id])).rows[0];assert.equal(c.is_published,true);assert.equal(c.hls_url,'https://cdn.hdqaz.online/candidates/test/master.m3u8');assert.equal((await db.query('select count(*) from telegram_publications')).rows[0].count,'1');});
test('concurrent repeated publish has one audit and one public post',async()=>{const w=await ready();await Promise.all([publish(w),publish(w)]);assert.equal((await db.query('select count(*) from telegram_channel_posts')).rows[0].count,'1');});
test('wrong actor and stale revision cannot edit or publish',async()=>{const w=await draft();await rejected(action('edit',w,{title:'bad'},456),'22023');await rejected(action('edit',{...w,revision:0},{title:'bad'}),'P0001');});
test('idempotency response survives restart; reused request with different payload fails',async()=>{const key=randomUUID();const a=await action('new',null,{kind:'movie'},123,key);assert.deepEqual(await action('new',null,{kind:'movie'},123,key),a);await rejected(action('new',null,{kind:'series'},123,key),'23505');});
test('series reuses title and season across episodes without recreating or editing title',async()=>{let w=await ready('series');await publish(w);const original=(await db.query('select * from contents where id=$1',[w.content_id])).rows[0];let second=await draft('series');second=await action('edit',second,{...second.metadata,episode_number:2});second=await action('prepare',second,{source_ref:randomUUID()});assert.equal(second.content_id,w.content_id);assert.equal((await db.query('select count(*) from seasons where content_id=$1',[w.content_id])).rows[0].count,'1');assert.deepEqual((await db.query('select * from contents where id=$1',[w.content_id])).rows[0],original);});
test('duplicate active episode fails and published targets are protected',async()=>{const w=await prepare('series');await rejected(prepare('series'),'23505');await action('activate',w);const j=await claim();await update(j,'heartbeat','processing',20);await update(j,'heartbeat','uploading',90);await update(j,'complete',null,null,'https://cdn.hdqaz.online/candidates/test/master.m3u8',{});await publish({...w,revision:w.revision+1,state:'submitted'});await rejected(prepare('series'),'P0001');});
test('incorrect manifest rejected without catalog changes',async()=>{const w=await ready();await rejected(action('publish',w,{manifest_url:'https://cdn.hdqaz.online/candidates/other/master.m3u8'}),'22023');assert.equal((await db.query('select is_published from contents where id=$1',[w.content_id])).rows[0].is_published,false);});
test('reject leaves Ready output unpublished and cannot later publish',async()=>{const w=await ready();const rejectedW=await action('reject',w);assert.equal(rejectedW.state,'rejected');await rejected(publish(rejectedW),'P0001');assert.equal((await db.query('select count(*) from telegram_channel_posts')).rows[0].count,'0');});
test('failed retry uses existing max-attempt contract',async()=>{let w=await prepare();w=await action('activate',w);const j=await claim();await update(j,'fail',null,null,null,{},'processing_failed');w=await action('retry',w);assert.equal((await db.query('select status from processing_jobs where id=$1',[j.id])).rows[0].status,'queued');});
test('runtime lease excludes another bot and persists offset',async()=>{await db.query("update telegram_runtime set lease_until=null,update_offset=0");const owner=randomUUID();await rpc('telegram_runtime_lease',[owner,20]);await rejected(rpc('telegram_runtime_lease',[randomUUID(),null]),'P0001');await rejected(rpc('telegram_runtime_lease',[owner,19]),'22023');await db.query("update telegram_runtime set lease_until=now()-interval '1 second'");assert.equal((await rpc('telegram_runtime_lease',[randomUUID(),null]))[0].telegram_runtime_lease.offset,20);});
test('outbox one claim, sent idempotency and no duplicate post',async()=>{await publish(await ready());const token=randomUUID();const call=(a,id=null,t=token,msg=null)=>rpc('telegram_post_action',[a,id,t,'-100123456789',msg]).then(x=>x[0].telegram_post_action);const first=await call('claim');assert.equal((await call('claim')).id,first.id);assert.equal(await call('claim',null,randomUUID()),null);await call('sent',first.id,token,42);await call('sent',first.id,token,42);assert.equal(await call('claim',null,randomUUID()),null);});
test('lost post result becomes uncertain and is never auto retried',async()=>{await publish(await ready());const p=(await rpc('telegram_post_action',['claim',null,randomUUID(),'-100123456789',null]))[0].telegram_post_action;await db.query("update telegram_channel_posts set claimed_at=now()-interval '10 minutes'");await rpc('telegram_post_action',['claim',null,randomUUID(),'-100123456789',null]);assert.equal((await db.query('select status from telegram_channel_posts where id=$1',[p.id])).rows[0].status,'uncertain');});
test('all Phase 4 tables/RPCs are private',async()=>{for(const role of ['anon','authenticated']){await db.query('set role '+role);for(const table of ['telegram_workflows','telegram_tmdb_titles','telegram_receipts','telegram_publications','telegram_channel_posts','telegram_runtime'])await rejected(db.query('select * from '+table),'42501');await rejected(rpc('telegram_runtime_lease',[randomUUID(),null]),'42501');await db.query('reset role');}});
