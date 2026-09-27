// Integration-only loopback HTTP bridge: actual Phase 2 route handlers + real disposable PostgreSQL.
// Not a production server. Reads no .env or production credentials.
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {randomBytes}=require('node:crypto');const {pathToFileURL}=require('node:url');
const repo=process.env.HDQAZ_REPO; if(!repo)throw new Error('HDQAZ_REPO required');process.chdir(repo);
const loader=require(path.join(repo,'tests/ts-loader.cjs'));
const tools=process.env.HDQAZ_TEST_TOOLS||'/private/tmp/hdqaz-phase2-test-tools';
const credential='integration-only-worker-credential-not-for-production';
const admin='integration-only-admin-credential-not-for-production';
let db,postgres,listener;
(async()=>{
 const Embedded=(await import(pathToFileURL(require.resolve('embedded-postgres',{paths:[tools]})).href)).default;
 postgres=new Embedded({databaseDir:await fs.mkdtemp(path.join(os.tmpdir(),'hdqaz-phase3-e2e-')),user:'postgres',password:randomBytes(24).toString('hex'),port:18439,persistent:false,onLog:()=>{},onError:()=>{}});
 await postgres.initialise();await postgres.start();db=postgres.getPgClient();await db.connect();
 await db.query('create role anon; create role authenticated; create role service_role bypassrls;');
 for(const name of ['202605120001_content_architecture.sql','202609260001_automation_foundation.sql','202609260002_processing_contract.sql'])await db.query(await fs.readFile(path.join(repo,'supabase/migrations',name),'utf8'));
 await db.query("insert into public.contents(id,title,slug,type,year) values('11111111-1111-4111-8111-111111111111','Synthetic Phase 3 test','synthetic-phase3-test','movie',2026)");
 const before=(await db.query('select to_jsonb(c) as data from public.contents c')).rows;
 const rpcArgs={automation_create_job:['p_content_id','p_episode_id','p_idempotency_key','p_max_attempts'],automation_claim_job:['p_worker_id'],automation_update_job:['p_job_id','p_worker_id','p_lease_token','p_action','p_stage','p_progress','p_manifest','p_metadata','p_error_code'],automation_retry_job:['p_job_id']};
 const client={async rpc(name,args){try{
  if(!rpcArgs[name])throw new Error('unsupported RPC');
  const values=rpcArgs[name].map(k=>args[k]===undefined?(k==='p_metadata'?{}:null):args[k]);
  const result=await db.query(`select * from public.${name}(${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);return {data:result.rows,error:null};
 }catch(e){return {data:null,error:{code:e.code}}}},
 from(table){if(!['processing_jobs','contents','episodes'].includes(table))throw Error('table');let fields,where=[],values=[],limit=100,offset=0;const q={
 select(s){if(!/^[a-z_,]+$/.test(s))throw Error('fields');fields=s;return q},order(){return q},range(a,b){offset=a;limit=b-a+1;return q},
 eq(k,v){if(k!=='status')throw Error('filter');values.push(v);where.push(`status=$${values.length}`);return q},
 in(k,v){if(k!=='id')throw Error('filter');values.push(v);where.push(`id=any($${values.length}::uuid[])`);return q},
 then(resolve,reject){db.query(`select ${fields} from public.${table}${where.length?' where '+where.join(' and '):''} order by id limit ${limit} offset ${offset}`,values).then(r=>resolve({data:r.rows,error:null}),reject)}
 };return q;}};
 let load;load=loader({'@/lib/supabase/admin':{getOptionalAdminClient:()=>client},'@/lib/api/auth':{async requireAdmin(req){if(req.headers.get('authorization')!=='Bearer '+admin){const {ApiError}=load('src/lib/api/errors.ts');throw new ApiError(403,'forbidden','Admin required')}}}},
 {AUTOMATION_WORKER_CREDENTIALS:JSON.stringify({integration_worker:credential}),BACKEND_ADMIN_TOKEN:admin,AUTOMATION_OUTPUT_ORIGINS:'https://cdn.example.test'});
 const jobs=load('src/app/api/automation/jobs/route.ts'),claim=load('src/app/api/automation/jobs/claim/route.ts'),action=load('src/app/api/automation/jobs/[jobId]/[action]/route.ts');
 listener=http.createServer(async(req,res)=>{try{
  if(req.url==='/test/assert-catalog' && req.headers.authorization==='Bearer '+admin){const after=(await db.query('select to_jsonb(c) as data from public.contents c')).rows;res.end(JSON.stringify({unchanged:JSON.stringify(before)===JSON.stringify(after)}));return;}
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384){res.writeHead(413);res.end();return;}chunks.push(chunk)}
  const request=new Request('http://127.0.0.1:18440'+req.url,{method:req.method,headers:req.headers,...(req.method==='GET'?{}:{body:Buffer.concat(chunks)})});
  let response;if(req.url==='/api/automation/jobs')response=await jobs[req.method](request);
  else if(req.url==='/api/automation/jobs/claim')response=await claim.POST(request);
  else{const match=req.url.match(/^\/api\/automation\/jobs\/([^/]+)\/([^/]+)$/);if(!match){res.writeHead(404);res.end();return;}
   response=await action.POST(request,{params:Promise.resolve({jobId:match[1],action:match[2]})});}
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
 }catch{res.writeHead(500);res.end('Integration bridge error')}});
 listener.listen(18440,'127.0.0.1',()=>console.log('PHASE2_TEST_BRIDGE_READY'));
})().catch(async()=>{console.error('Integration setup failed');if(db)await db.end();if(postgres)await postgres.stop();process.exit(1)});
async function close(){if(listener)listener.close();if(db)await db.end();if(postgres)await postgres.stop();process.exit(0)}
process.on('SIGTERM',close);process.on('SIGINT',close);
