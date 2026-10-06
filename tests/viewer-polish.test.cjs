const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./ts-loader.cjs')();
const { resumableSeconds } = load('src/lib/watch-progress.ts');
const { movieMatchesSearch, movieSearchRank, normalizeSearchValue } = load('src/features/movies/search.ts');
const movie = {title:'Интерстеллар', originalTitle:'Interstellar', description:'', slug:'interstellar', type:'movie', year:2014, runtime:'', rating:'', badges:[], genres:[], catalogs:[], languages:[]};
test('search exact, partial, Latin, year, punctuation, Cyrillic and typo', () => {
  for (const q of ['Интерстеллар','ИНТЕР',' Interstellar ','интерстелар','2014','Интерстеллар!']) assert.equal(movieMatchesSearch(movie,q),true,q);
  assert.equal(movieMatchesSearch(movie,'zzzzqqq'),false);
  assert.ok(movieSearchRank(movie,'интер') < movieSearchRank({...movie,title:'Жұлдыз Интер', originalTitle:''},'интер'));
  assert.equal(normalizeSearchValue('  ҚАЗАҚ—Ёлка  '),'қазақ елка');
});
test('episode/season/movie progress keys remain independent', () => {
  const store = new Map([['watch-progress:episode:s1-e1',JSON.stringify({seconds:3000,completed:false})],['watch-progress:episode:s1-e2',JSON.stringify({seconds:720,completed:false})],['watch-progress:movie:a',JSON.stringify({seconds:2400,completed:false})]]);
  for(const [key,seconds] of [['episode:s1-e1',3000],['episode:s1-e2',720],['episode:s2-e1',0],['episode:s1-e3',0],['movie:a',2400],['movie:b',0]]) assert.equal(resumableSeconds(store.get('watch-progress:'+key)??null,4000),seconds);
});
test('completed, start-over, too-short and malformed progress never resumes', () => {
  for(const raw of ['null','{}','bad','{"seconds":"50","completed":false}',JSON.stringify({seconds:3600,completed:false}),JSON.stringify({seconds:1200,completed:true}),JSON.stringify({seconds:0,completed:false}),JSON.stringify({seconds:29,completed:false})]) assert.equal(resumableSeconds(raw,4000),0,raw);
  assert.equal(resumableSeconds(null,4000,3000),3000);
});
