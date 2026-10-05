import 'server-only';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { requireAdmin } from '@/lib/api/auth';
import { botAuth } from '@/features/telegram/auth';
import { MEDIA_BUCKET } from '@/features/telegram/media-url';
import { uuid } from '@/features/processing/validation';
import { requireSameOrigin } from '@/features/processing/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, isApiError } from '@/lib/api/errors';
const MAX=3*1024*1024;
function invalid():never{throw new ApiError(400,'invalid_image','Жарамды JPG, PNG немесе WEBP суретін жіберіңіз.');}
async function bytes(request:Request){
 if(Number(request.headers.get('content-length')||0)>MAX)throw new ApiError(413,'too_large','Image too large.');
 const reader=request.body?.getReader();if(!reader)return invalid();const parts:Uint8Array[]=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX){await reader.cancel();throw new ApiError(413,'too_large','Image too large.');}parts.push(value);}}finally{reader.releaseLock();}
 if(!total)return invalid();return Buffer.concat(parts,total);
}
export async function normalizeImage(data:Buffer){
 try{const image=sharp(data,{limitInputPixels:10000000,failOn:'warning'}),info=await image.metadata();if(!['jpeg','png','webp'].includes(info.format||'')||(info.pages||1)!==1)return invalid();const output=await image.rotate().resize(2560,2560,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();if(output.length>2*1024*1024)return invalid();return output;}catch{return invalid();}
}
export async function mediaRequest(request:Request, web=false){
 try{
  requireSameOrigin(request);const actor=web?(await requireAdmin(request),null):botAuth(request,true)!;
  if(!['image/jpeg','image/png','image/webp'].includes(request.headers.get('content-type')||''))return invalid();
  const id=uuid(request.headers.get('x-target-id')),key=uuid(request.headers.get('x-request-id')),field=request.headers.get('x-media-field');
  if(field!=='poster_url'&&field!=='banner_url')return invalid();
  const scope=request.headers.get('x-workflow');if(scope!=='true'&&scope!=='false')return invalid();const flow=scope==='true';if(web&&flow)return invalid();const version=request.headers.get('x-version')||'';
  if(flow?!/^(0|[1-9][0-9]{0,9})$/.test(version):!/^\d{4}-\d{2}-\d{2}T/.test(version)||!Number.isFinite(Date.parse(version)))return invalid();
  const db=createAdminClient();const selected=flow?await db.from('telegram_workflows').select('id,actor_id,state,revision,metadata,content_id').eq('id',id).eq('actor_id',actor).single():await db.from('contents').select('id,updated_at,poster_url,banner_url').eq('id',id).single();
  if(selected.error||!selected.data)throw new ApiError(404,'not_found','Content not found.');const target=selected.data as { state?:string; revision?:number; metadata?:Record<string,unknown>; content_id?:string; updated_at?:string; poster_url?:string; banner_url?:string };const meta=target.metadata||{};
  if(flow&&target.state!=='draft')throw new ApiError(409,'stale','Refresh and retry.');
  const data=await normalizeImage(await bytes(request));const hash=createHash('sha256').update(data).digest('hex').slice(0,16);
  // Immutable revisions prevent stale requests overwriting the currently displayed image.
  const owner=flow?((target.content_id?uuid(target.content_id):meta.existing_content_id?uuid(meta.existing_content_id):'drafts/'+id)):id;
  // The cleanup grace period exceeds this route's 60s lifetime, so existing
  // uploads finish before cleanup; refuse every new write to a fenced owner.
  const cleanup=db.from('content_cleanup_tasks').select('id');
  const fenced=await (owner.startsWith('drafts/')?cleanup.contains('snapshot',{flows:[{id}]}):cleanup.eq('content_id',owner)).limit(1);
  if(fenced.error)throw new ApiError(503,'storage_unavailable','Сурет сақталмады.');
  if(fenced.data?.length)throw new ApiError(409,'cleanup_in_progress','Контент толық жойылып жатыр.');
  const path=(field==='poster_url'?'posters/':'banners/')+owner+'/'+(field==='poster_url'?'poster-':'banner-')+key+'-'+hash+'.webp';
  const store=db.storage.from(MEDIA_BUCKET),url=store.getPublicUrl(path).data.publicUrl;
  const current=flow?meta[field]:target[field];
  if((flow?target.revision!==Number(version):Date.parse(target.updated_at||'')!==Date.parse(version))){if(current===url)return Response.json({data:{url}});throw new ApiError(409,'stale','Refresh and retry.');}
  await store.upload(path,data,{contentType:'image/webp',cacheControl:'31536000',upsert:false});
  // A lost upload acknowledgement or retry is safe when stored bytes match exactly.
  // Verify through authenticated Storage, not an arbitrary external URL.
  const verified=await store.download(path);if(verified.error||!verified.data||verified.data.size!==data.length||!Buffer.from(await verified.data.arrayBuffer()).equals(data))throw new ApiError(503,'storage_unavailable','Сурет сақталмады.');
  const result=web?await db.from('contents').update({[field]:url}).eq('id',id).eq('updated_at',version).select('id').maybeSingle():flow?await db.rpc('telegram_workflow_action',{p_actor:actor,p_request:key,p_id:id,p_revision:Number(version),p_action:'edit',p_data:{...meta,[field]:url}}):await db.rpc('telegram_catalog_action',{p_actor:actor,p_request:key,p_id:id,p_expected:version,p_action:'edit',p_data:{[field]:url}});
  if(result.error||(web&&!result.data))throw new ApiError(409,'stale','Refresh and retry.');
  return Response.json({data:{url}},{headers:{'Cache-Control':'no-store'}});
 }catch(error){const known=isApiError(error);return Response.json({error:{code:known?error.code:'media_unavailable',message:known?error.message:'Сурет сақталмады. Қайта көріңіз.'}},{status:known?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
