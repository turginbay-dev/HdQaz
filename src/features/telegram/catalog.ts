import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError } from '@/lib/api/errors';
import { integer, invalid, metadata, short } from '@/features/telegram/validation';
import { uuid } from '@/features/processing/validation';
const columns='id,title,slug,type,section,description,year,country,duration_minutes,is_premium,dubber_id,poster_url,banner_url,hls_url,is_published,updated_at';
function checked<T>(r:{data:T,error:unknown}):NonNullable<T>{if(r.error){const message=(r.error as {message?:string}).message;const errors:Record<string,string>={'Series metadata incomplete':'Сериал мәліметтері толық емес.','Movie video not Ready':'Фильм видеосы дайын емес. Дайын видеоны тексеріңіз.'};throw new ApiError(409,'catalog_conflict',errors[message||'']||'Контентті жаңартып қайта көріңіз.');}if(r.data==null)throw new ApiError(404,'not_found','Content not found.');return r.data;}
export function classification(c:{type:string,section?:string|null,hls_url?:string|null}){
 return {kind:c.type==='movie'||c.type==='cartoon'||(c.type!=='series'&&!!c.hls_url)?'movie':'series',section:c.section||(['anime','dorama'].includes(c.type)?c.type:'default')};
}
export function catalogPatch(d:Record<string,unknown>){
 if(!d||typeof d!=='object'||Array.isArray(d))return invalid();
 const allowed=['title','description','year','country','genres','duration_minutes','is_premium','dubber_id','poster_url','banner_url'];
 if(!Object.keys(d).length||Object.keys(d).some(k=>!allowed.includes(k)))return invalid();
 const patch=metadata(d);if('dubber_id' in d&&d.dubber_id===null)patch.dubber_id=null;
 if('description' in d&&d.description==='')patch.description='';
 if(!Object.keys(patch).length)return invalid();return patch;
}
function channelEnabled(){const mode=process.env.TELEGRAM_CHANNEL_MODE;const channel=process.env.TELEGRAM_CHANNEL_ID||'';return ['test','live'].includes(mode||'')&&/^(-100[0-9]{5,}|@[A-Za-z0-9_]{5,32})$/.test(channel)&&(mode!=='test'||channel===process.env.TELEGRAM_TEST_CHANNEL_ID);}
export async function catalogAction(action:string,actor:number,b:Record<string,unknown>,d:Record<string,unknown>):Promise<unknown>{
 const db=createAdminClient();
 if(action==='admin_options')return {genres:checked(await db.from('genres').select('id,name').order('name')),dubbers:checked(await db.from('dubbers').select('id,name').eq('is_active',true).limit(50)),channel_enabled:channelEnabled()};
 if(action==='catalog'){
  const page=integer(d.page??0,0,10000),filter=d.filter??'all';
  if(!['all','movie','series','anime','dorama','published','draft'].includes(String(filter)))return invalid();
  let q=db.from('contents').select(columns,{count:'exact'}).order('created_at',{ascending:false}).order('id');
  if(d.query){const text=short(d.query,100).replace(/[%_\\]/g,'');if(!text)return invalid();q=q.ilike('title','%'+text+'%');}
  if(filter==='movie')q=q.or('type.eq.movie,type.eq.cartoon,and(type.in.(anime,dorama),hls_url.not.is.null)');
  if(filter==='series')q=q.or('type.eq.series,and(type.in.(anime,dorama),hls_url.is.null)');
  if(filter==='anime'||filter==='dorama')q=q.or('section.eq.'+filter+',type.eq.'+filter);
  if(filter==='published'||filter==='draft')q=q.eq('is_published',filter==='published');
  const res=await q.range(page*5,page*5+4);const rows=checked(res);
  return {items:rows.map(c=>({...c,...classification(c)})),page,has_next:(res.count||0)>(page+1)*5};
 }
 const id=uuid(b.id);
 if(action==='catalog_edit'||action==='catalog_publish'||action==='catalog_unpublish'){
  const expected=short(d.expected,40);if(!/^\d{4}-\d{2}-\d{2}T/.test(expected)||!Number.isFinite(Date.parse(expected)))return invalid();
  const patch=action==='catalog_edit'?catalogPatch(d.patch as Record<string,unknown>):{};
  return checked(await db.rpc('telegram_catalog_action',{p_actor:actor,p_request:uuid(b.request_id),p_id:id,p_expected:expected,p_action:action.slice(8),p_data:patch}));
 }
 if(action==='catalog_get'){
  const c=checked(await db.from('contents').select(columns).eq('id',id).single());
  const [seasonRes,episodeRes,genreRes,dubberRes,flowRes]=await Promise.all([
   db.from('seasons').select('id,season_number,title').eq('content_id',id).order('season_number'),
   db.from('episodes').select('id,season_id,episode_number,title,is_published,hls_url').eq('content_id',id).order('episode_number').limit(1000),
   db.from('content_genres').select('genres(name)').eq('content_id',id),
   c.dubber_id?db.from('dubbers').select('name').eq('id',c.dubber_id).single():Promise.resolve({data:null,error:null}),
   db.from('telegram_workflows').select('id,revision,state,kind,job_id').eq('content_id',id).eq('actor_id',actor).order('created_at',{ascending:false}).limit(20)
  ]);
  const workflows=checked(flowRes),jobIds=workflows.flatMap(w=>w.job_id?[w.job_id]:[]);
  const jobs=jobIds.length?checked(await db.from('processing_jobs').select('id,status,progress_percent,output_manifest_url').in('id',jobIds)):[];
  return {...c,...classification(c),seasons:checked(seasonRes),episodes:checked(episodeRes),genres:checked(genreRes).flatMap(g=>{const genre=g.genres as unknown as {name:string}|null;return genre?[genre.name]:[];}),dubber_name:dubberRes.data?.name||null,
   workflows:workflows.map(w=>({...w,job:jobs.find(j=>j.id===w.job_id)||null})),watch_url:c.is_published?'https://hdqaz.online/'+encodeURIComponent(c.slug):null,channel_enabled:channelEnabled()};
 }
 if(action==='catalog_post'){
  if(!channelEnabled())throw new ApiError(403,'posting_disabled','Telegram channel is not configured.');
  const c=checked(await db.from('contents').select('is_published').eq('id',id).single());if(!c.is_published)return invalid();
  const w=checked(await db.from('telegram_workflows').select('id,revision').eq('content_id',id).eq('actor_id',actor).eq('state','published').order('created_at',{ascending:false}).limit(1).maybeSingle());
  const post=checked(await db.from('telegram_channel_posts').select('status').eq('workflow_id',w.id).single());
  if(post.status==='failed')checked(await db.rpc('telegram_workflow_action',{p_actor:actor,p_request:uuid(b.request_id),p_action:'post_retry',p_id:w.id,p_revision:w.revision,p_data:{}}));
  return {status:post.status==='failed'?'pending':post.status};
 }
 return invalid();
}
