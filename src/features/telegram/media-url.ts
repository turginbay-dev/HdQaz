export const MEDIA_BUCKET='content-media';
export function isContentMediaUrl(value:string){
 try{const u=new URL(value),base=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||'');return u.origin===base.origin&&u.protocol==='https:'&&!u.search&&!u.hash&&!u.username&&!u.password&&new RegExp('^/storage/v1/object/public/'+MEDIA_BUCKET+'/(posters|banners)/[a-zA-Z0-9/_.-]+\\.webp$').test(u.pathname);}catch{return false;}
}
