const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./ts-loader.cjs');
test('immediate unpublish patches only publication with version fencing',async()=>{
 const row={id:'id',title:'Reviewed',slug:'reviewed',type:'movie',section:'default',description:'',poster_url:'',banner_url:'',country:'',year:2026,status:'ongoing',is_published:true,hls_url:'https://cdn.hdqaz.online/movie/master.m3u8'};let written;const filters=[];
 const db={from(table){let one=false;const q={then(resolve){return resolve({data:table==='contents'?(one?row:[row]):[],error:null});}};q.eq=(...args)=>{filters.push(args);return q};for(const name of ['select','in','order'])q[name]=()=>q;q.maybeSingle=()=>{one=true;return q;};q.update=data=>{written=data;Object.assign(row,data);return q};return q}};
 const repo=loader({'@/lib/supabase/admin':{getOptionalAdminClient:()=>db}})('src/features/content/repository.ts');const result=await repo.unpublishContent('reviewed','2026-10-05T12:00:00Z');assert.equal(result.isPublished,false);assert.equal(JSON.stringify(written),JSON.stringify({is_published:false}));assert.ok(filters.some(f=>f[0]==='updated_at'));assert.equal(result.hlsUrl,row.hls_url);
});
test('coming soon catalog follows content status without altering HLS',()=>{
 const {contentToMovieRecord}=loader()('src/features/content/repository.ts');
 const c={id:'fixture',slug:'new-fixture',title:'Fixture',genres:[],episodes:[],episodeCount:0,status:'announced',type:'movie',storageType:'movie',year:2026,hlsUrl:null};assert.ok(contentToMovieRecord(c).catalogs.includes('coming-soon'));assert.ok(!contentToMovieRecord({...c,status:'ongoing',hlsUrl:'https://cdn.hdqaz.online/master.m3u8'}).catalogs.includes('coming-soon'));
});
test('unpublish endpoint rejects publish and foreign origins before mutation',async()=>{
 let calls=0;const mod=loader({'@/lib/api/auth':{requireAdmin:async()=>{}},'@/features/content/repository':{unpublishContent:async()=>{calls++;return {isPublished:false}}}})('src/app/api/contents/[slug]/publication/route.ts');const context={params:Promise.resolve({slug:'fixture'})};
 const request=(origin,value)=>new Request('https://hdqaz.online/api',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({isPublished:value,expectedUpdatedAt:'2026-10-05T12:00:00Z'})});
 assert.equal((await mod.POST(request('https://evil.test',false),context)).status,403);assert.equal((await mod.POST(request('https://hdqaz.online',true),context)).status,400);assert.equal(calls,0);assert.equal((await mod.POST(request('https://hdqaz.online',false),context)).status,200);assert.equal(calls,1);
});
