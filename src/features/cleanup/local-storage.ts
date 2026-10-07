import 'server-only';
import {createAdminClient} from '@/lib/supabase/admin';
import {ApiError} from '@/lib/api/errors';
import {uuid} from '@/features/processing/validation';
const columns='id,status,progress_percent,attempt_count,heartbeat_at,lease_expires_at,admin_cancelled_at,error_code,content_id';
function checked<T>(r:{data:T,error:unknown}):NonNullable<T>{if(r.error||r.data==null)throw new ApiError(503,'storage_unavailable','Storage state unavailable.');return r.data;}
function ids(value:unknown):string[]{if(!Array.isArray(value)||value.length>100)throw new ApiError(400,'invalid_storage','At most 100 IDs required.');return [...new Set(value.map(uuid))];}
export async function localStorageAction(b:Record<string,unknown>){
 const db=createAdminClient();
 if(b.action==='local_inspect'){
  const jobs=ids(b.jobs),sources=ids(b.sources);
  const flows=sources.length?checked(await db.from('telegram_workflows').select('id,source_ref,job_id,state').in('source_ref',sources).limit(1000)):[];
  // Supabase may cap responses at 1000: equality is also rejected (no inferred completeness).
  if(flows.length>=1000)throw new ApiError(503,'storage_unavailable','Reference set exceeds safe scan bound.');
  const all=[...new Set([...jobs,...flows.flatMap(f=>f.job_id?[f.job_id]:[])])];
  if(all.length>=1000)throw new ApiError(503,'storage_unavailable','Job set exceeds safe scan bound.');
  const rows=all.length?checked(await db.from('processing_jobs').select(columns).in('id',all).limit(1000)):[];
  const contents=[...new Set(rows.map(j=>j.content_id))];
  const titles=contents.length?checked(await db.from('contents').select('id,title').in('id',contents).limit(1000)):[];
  return {jobs:rows.map(j=>({...j,title:titles.find(c=>c.id===j.content_id)?.title||'Видео'})),sources:sources.map(id=>({id,flows:flows.filter(f=>f.source_ref===id)}))};
 }
 if(b.action==='local_stale'){
  const id=uuid(b.id);
  if(typeof b.heartbeat_at!=='string'||!Number.isFinite(Date.parse(b.heartbeat_at))||typeof b.attempt_count!=='number'||!Number.isInteger(b.attempt_count)||b.attempt_count<1||b.attempt_count>10||typeof b.progress_percent!=='number'||!Number.isInteger(b.progress_percent)||b.progress_percent<0||b.progress_percent>100)throw new ApiError(400,'invalid_storage','Invalid observation.');
  // Local no-progress/process-lock evidence comes only from the cleanup credential.
  // This conditional write fences a concurrent heartbeat, claim or retry.
  const cutoff=new Date(Date.now()-30*60*1000).toISOString();
  const rows=checked(await db.from('processing_jobs').update({status:'failed',error_code:'STALE_JOB_CLEANUP',finished_at:new Date().toISOString(),worker_id:null,lease_token:null,lease_expires_at:null,heartbeat_at:null,next_attempt_at:null})
   .eq('id',id).in('status',['downloading','processing','uploading']).eq('heartbeat_at',b.heartbeat_at).eq('attempt_count',b.attempt_count).eq('progress_percent',b.progress_percent)
   .lt('heartbeat_at',cutoff).lt('lease_expires_at',new Date().toISOString()).select('id'));
  return {failed:rows.length===1};
 }
 throw new ApiError(400,'invalid_storage','Invalid storage action.');
}
