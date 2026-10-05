import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {createAdminClient} from '@/lib/supabase/admin';
import {requireAdmin} from '@/lib/api/auth';
import {requireSameOrigin} from '@/features/processing/auth';
import {uuid} from '@/features/processing/validation';
import {readJsonObject} from '@/lib/api/request';
import {ApiError} from '@/lib/api/errors';
import {handleApiError,ok} from '@/lib/api/responses';
import {cleanupPlan,validResults,type Snapshot,type Result,type Asset} from '@/features/cleanup/plan';
type Task={id:string;content_id:string;status:string;snapshot:Snapshot;results:Result[];lease_token?:string};
export function cleanupCredential(){const configured=process.env.CONTENT_CLEANUP_TOKEN;const parent=process.env.TELEGRAM_BACKEND_TOKEN;
 if(configured&&configured.length>=32&&configured!==parent&&configured!==process.env.BACKEND_ADMIN_TOKEN&&configured!==process.env.SUPABASE_SERVICE_ROLE_KEY)return configured;
 if(!configured&&parent&&parent.length>=32)return createHmac('sha256',parent).update('HDQaz content cleanup executor v1').digest('hex');
 throw new ApiError(503,'cleanup_unavailable','Тазарту қызметі бапталмаған.');}
export function cleanupAuth(request:Request){const supplied=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1]||'';if(!supplied||supplied.length>512)throw new ApiError(401,'unauthorized','Cleanup authentication required.');const expected=cleanupCredential();if(Buffer.byteLength(supplied)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))throw new ApiError(401,'unauthorized','Cleanup authentication required.');}
function plan(t:Task){const origin=process.env.NEXT_PUBLIC_SUPABASE_URL||'';const origins=(process.env.AUTOMATION_OUTPUT_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);if(!origin||!origins.length)throw new ApiError(503,'cleanup_unavailable','Storage cleanup is not configured.');return cleanupPlan(t.snapshot,origins,new URL(origin).origin);}
function checked<T>(r:{data:T;error:unknown}):NonNullable<T>{if(r.error||!r.data)throw new ApiError(409,'cleanup_conflict','Контентті жаңартып қайта көріңіз.');return r.data;}
function view(t:Task){const assets=plan(t);return {id:t.id,content_id:t.content_id,title:t.snapshot.content.title,status:t.status,remaining:assets.filter(a=>!t.results?.some(r=>r.id===a.id&&r.state!=='error')).flatMap(a=>(t.results?.find(r=>r.id===a.id)?.paths||[a.path]).map(path=>({kind:a.kind,path}))),retained:assets.filter(a=>a.shared).map(a=>({kind:a.kind,path:a.path}))};}
async function images(assets:Asset[],results:Result[]){const bucket=createAdminClient().storage.from('content-media');for(const a of assets.filter(a=>a.kind==='image')){
 if(a.shared){results.push({id:a.id,state:'shared'});continue;}
 try{let rounds=0;while(true){if(++rounds>100)throw Error();const listed=await bucket.list(a.path.replace(/\/$/,''),{limit:100});if(listed.error)throw Error();if(!listed.data?.length)break;const keys=listed.data.map(f=>{if(!f.id||!f.name||f.name.includes('/')||f.name==='..')throw Error();return a.path+f.name;});const removed=await bucket.remove(keys);if(removed.error)throw Error();}results.push({id:a.id,state:'done'});}
 catch{results.push({id:a.id,state:'error',error:'storage_unavailable'});}
 }}
export async function cleanupAdmin(request:Request){try{requireSameOrigin(request);await requireAdmin(request);const db=createAdminClient();
 if(request.method==='GET'){const rows=checked(await db.from('content_cleanup_tasks').select('*').neq('status','done').order('created_at',{ascending:false}).limit(50));return ok((rows as Task[]).map(view));}
 const body=await readJsonObject(request);const contentId=uuid(body.contentId);
 if(body.action==='retry'){const t=checked(await db.from('content_cleanup_tasks').update({status:'queued',not_before:new Date().toISOString()}).eq('content_id',contentId).eq('status','partial').select('*').single()) as Task;return ok(view(t));}
 if(body.action!=='start'||typeof body.confirmation!=='string'||typeof body.expectedUpdatedAt!=='string'||!Number.isFinite(Date.parse(body.expectedUpdatedAt)))throw new ApiError(400,'invalid_cleanup','Атауды дәл қайталап жазыңыз.');
 const t=checked(await db.rpc('content_cleanup_begin',{p_id:contentId,p_expected:body.expectedUpdatedAt,p_title:body.confirmation})) as Task;return ok(view(t));
 }catch(e){return handleApiError(e);}}
export async function cleanupExecutor(request:Request){try{cleanupAuth(request);const db=createAdminClient();const b=await readJsonObject(request);
 if(b.action==='claim'){const r=await db.rpc('content_cleanup_claim');if(r.error)throw new ApiError(503,'cleanup_unavailable','Cleanup queue unavailable.');const t=r.data as Task|null;return ok(t?{id:t.id,lease_token:t.lease_token,assets:plan(t),workflow_ids:t.snapshot.flows.map(f=>f.id),source_refs:t.snapshot.flows.map(f=>f.source_ref).filter(Boolean),protected_source_refs:t.snapshot.references.filter(r=>r.owner!==t.content_id).map(r=>r.source_ref).filter(Boolean)}:null);}
 if(b.action!=='report')throw new ApiError(400,'invalid_cleanup','Invalid action.');const taskId=uuid(b.id),token=uuid(b.lease_token);const t=checked(await db.from('content_cleanup_tasks').select('*').eq('id',taskId).single()) as Task;
 if(t.status==='done')return ok(view(t));const assets=plan(t);if(t.status!=='running'||t.lease_token!==token||!validResults(assets,b.results))throw new ApiError(409,'cleanup_conflict','Cleanup ownership changed.');
 const results=(b.results as Result[]).filter(r=>assets.find(a=>a.id===r.id)?.kind!=='image');await images(assets,results);
 const done=results.length===assets.length&&results.every(r=>r.state==='done'||r.state==='shared');const updated=checked(await db.rpc('content_cleanup_report',{p_id:taskId,p_token:token,p_results:results,p_done:done})) as Task;
 if(!done&&results.filter(r=>r.state==='error').every(r=>r.error==='local_busy')){const queued=checked(await db.from('content_cleanup_tasks').update({status:'queued',not_before:new Date(Date.now()+15000).toISOString()}).eq('id',taskId).eq('status','partial').select('*').single()) as Task;return ok(view(queued));}
 return ok(view(updated));
 }catch(e){return handleApiError(e);}}
