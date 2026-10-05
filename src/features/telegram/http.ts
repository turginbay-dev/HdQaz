import 'server-only';
import { catalogAction } from '@/features/telegram/catalog';
import { botAuth } from '@/features/telegram/auth';
import { integer, invalid, jsonBody, metadata, short } from '@/features/telegram/validation';
import { tmdbDetails, tmdbSearch } from '@/features/telegram/tmdb';
import { ApiError, isApiError } from '@/lib/api/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { manifestUrl, uuid } from '@/features/processing/validation';
import { requireSameOrigin } from '@/features/processing/auth';
const headers={'Cache-Control':'no-store',Vary:'Authorization'};
function checked<T>(result:{data:T;error:{code?:string}|null}):NonNullable<T>{
 if(result.error)throw new ApiError(['P0001','23505','23514','23503','22023'].includes(result.error.code||'')?409:503,'workflow_conflict','Workflow changed or is unavailable. Refresh and try again.');if(result.data==null)throw new ApiError(404,'not_found','Record not found.');return result.data;
}
async function workflow(actor:number,id:string){const d=checked(await createAdminClient().from('telegram_workflows').select('*').eq('actor_id',actor).eq('id',id).maybeSingle());if(!d)throw new ApiError(404,'not_found','Workflow not found.');return d;}
const jobColumns='id,content_id,episode_id,status,progress_percent,attempt_count,max_attempts,output_manifest_url,output_metadata,error_code';
export async function telegramRequest(request:Request){
 try{
  requireSameOrigin(request);botAuth(request,false);const b=await jsonBody(request);const action=short(b.action,32);
  if(Object.keys(b).some(k=>!['action','request_id','id','revision','data'].includes(k)))return invalid();
  const data=b.data==null?{}:b.data;if(!data||typeof data!=='object'||Array.isArray(data))return invalid();const d=data as Record<string,unknown>;
  let result:unknown;const db=createAdminClient();
  if(action==='runtime'){
   result=checked(await db.rpc('telegram_runtime_lease',{p_owner:uuid(d.owner),p_offset:d.offset==null?null:integer(d.offset)}));
  }else if(action==='post_claim'||action==='post_result'){
   const mode=process.env.TELEGRAM_CHANNEL_MODE||'disabled';
   const channel=process.env.TELEGRAM_CHANNEL_ID||'';
   if(!['test','live'].includes(mode)||!/^(-100[0-9]{5,}|@[A-Za-z0-9_]{5,32})$/.test(channel))throw new ApiError(403,'posting_disabled','Channel posting disabled.');
   if(mode==='test'&&channel!==process.env.TELEGRAM_TEST_CHANNEL_ID)throw new ApiError(503,'configuration','Test channel unavailable.');
   const operation=action==='post_claim'?'claim':short(d.status,16);if(!['claim','sent','failed','uncertain'].includes(operation))return invalid();
   const postResult=await db.rpc('telegram_post_action',{p_action:operation,p_id:action==='post_claim'?null:uuid(b.id),p_token:uuid(d.token),p_channel:channel,p_message:d.message_id==null?null:integer(d.message_id,1)});
   if(postResult.error)checked(postResult);const row=postResult.data;
   result=row;
   if(action==='post_claim'&&row){
    const w=checked(await db.from('telegram_workflows').select('content_id,episode_id,state').eq('id',row.workflow_id).single());
    if(w.state!=='published')throw new ApiError(409,'not_published','Publication required.');
    const c=checked(await db.from('contents').select('title,slug,year,poster_url,banner_url,is_published').eq('id',w.content_id).single());
    if(!c.is_published)throw new ApiError(409,'not_published','Title is not public.');
    const base=new URL(process.env.TELEGRAM_SITE_URL||'https://hdqaz.online');
    if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)return invalid();
    const link=new URL('/'+encodeURIComponent(c.slug),base);
    if(w.episode_id){const ep=checked(await db.from('episodes').select('slug,is_published').eq('id',w.episode_id).eq('content_id',w.content_id).single());if(!ep.is_published)throw new ApiError(409,'not_published','Episode is not public.');link.searchParams.set('episode',ep.slug);}
    link.searchParams.set('utm_source','telegram');link.searchParams.set('utm_medium','channel');
    result={...row,mode,title:c.title,year:c.year,poster_url:c.poster_url,banner_url:c.banner_url,watch_url:link.href};
   }
  }else{
   const actor=botAuth(request,true)!;
   if(action.startsWith('catalog')||action==='admin_options'){
    result=await catalogAction(action,actor,b,d);
   }else if(action==='search'){
    const kind=d.kind;if(kind!=='movie'&&kind!=='series')return invalid();result=await tmdbSearch(kind,short(d.query,150));
   }else if(action==='titles'){
    const q=short(d.query,100).replace(/[%_,()]/g,'');result=checked(await db.from('contents').select('id,title,year,type').neq('type','movie').ilike('title','%'+q+'%').limit(6));
   }else if(action==='dubbers')result=checked(await db.from('dubbers').select('id,name').eq('is_active',true).limit(50));
   else if(action==='queue'){
    const rows=checked(await db.from('telegram_workflows').select('*').eq('actor_id',actor).order('created_at',{ascending:false}).limit(20));
    const ids=rows.flatMap(w=>w.job_id?[w.job_id]:[]);const jobs=ids.length?checked(await db.from('processing_jobs').select(jobColumns).in('id',ids)):[];
    result=rows.map(w=>({...w,job:jobs.find(j=>j.id===w.job_id)||null}));
   }else if(action==='get'){
    const w=await workflow(actor,uuid(b.id));const c=w.content_id?checked(await db.from('contents').select('slug').eq('id',w.content_id).single()):null;result={...w,watch_url:c?'https://hdqaz.online/'+encodeURIComponent(c.slug):null,job:w.job_id?checked(await db.from('processing_jobs').select(jobColumns).eq('id',w.job_id).single()):null};
   }else{
    let op=action;let payload:Record<string,unknown>=d;
    const id=action==='new'?null:uuid(b.id);const revision=action==='new'?null:integer(b.revision,0,2147483647);
    if(action==='new'){if(d.kind!=='movie'&&d.kind!=='series')return invalid();if(d.section!=null&&!['default','anime','dorama'].includes(String(d.section)))return invalid();payload={kind:d.kind,section:d.section||'default'};}
    else{
     const w=await workflow(actor,id!);
     if(action==='select') {if(w.metadata.title)throw new ApiError(409,'metadata_selected','Start a new draft to select another title.');payload=metadata({...w.metadata,...await tmdbDetails(w.kind,integer(d.tmdb_id,1,2147483647))});op='edit';}
     else if(action==='existing'){
      const c=checked(await db.from('contents').select('id,title,year,type,section,description,country,duration_minutes,is_premium,dubber_id,hls_url,is_published').eq('id',uuid(d.content_id)).single());
      if(w.kind==='movie'?(c.type!=='movie'||c.is_published||c.hls_url):(c.type==='movie'||c.type==='cartoon'||c.hls_url))return invalid();
      payload=metadata({existing_content_id:c.id,title:c.title,year:c.year,section:c.section||(['anime','dorama'].includes(c.type)?c.type:'default'),description:c.description,country:c.country,duration_minutes:c.duration_minutes,is_premium:c.is_premium,dubber_id:c.dubber_id});op='edit';
     }else if(action==='edit')payload=metadata(d);
     else if(action==='source'){payload={source_ref:uuid(d.source_ref)};}
     else if(action==='prepare'){metadata(w.metadata);if(!w.metadata.title||!w.metadata.year)return invalid();payload={source_ref:uuid(d.source_ref)};}
     else if(action==='publish'){
      const j=checked(await db.from('processing_jobs').select('output_manifest_url').eq('id',w.job_id).single());payload={manifest_url:manifestUrl(j.output_manifest_url,process.env.AUTOMATION_OUTPUT_ORIGINS||'')};
     }else if(!['activate','reject','retry','post_retry'].includes(action))return invalid();
     else payload={};
    }
    result=checked(await db.rpc('telegram_workflow_action',{p_actor:actor,p_request:uuid(b.request_id),p_action:op,p_id:id,p_revision:revision,p_data:payload}));
   }
  }
  return Response.json({data:result},{headers});
 }catch(e){return Response.json({error:{code:isApiError(e)?e.code:'unavailable',message:isApiError(e)?e.message:'Bot service unavailable.'}},{status:isApiError(e)?e.status:503,headers});}
}
