const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  vm.runInNewContext(code, { exports, URL, require(name) {
    if (name === '@/lib/api/errors') return load('src/lib/api/errors.ts');
    if (name === '@/features/content/format') return load('src/features/content/format.ts');
    throw new Error(`Unexpected import: ${name}`);
  }});
  return exports;
}
const { parseEpisodeInput } = load('src/features/content/validation.ts');
test('draft accepts absent, null or empty HLS and defaults unpublished', () => {
  for (const hlsUrl of [undefined, null, '']) {
    const result = parseEpisodeInput({ episodeNumber: 1, hlsUrl });
    assert.equal(result.errors, null);
    assert.equal(result.data.hlsUrl, null);
    assert.equal(result.data.isPublished, false);
  }
});
test('publish requires HLS and rejects non-manifest URLs', () => {
  for (const hlsUrl of [undefined, '', 'https://cdn.example.org/file.mp4', 'javascript:alert(1)']) {
    assert.ok(parseEpisodeInput({ episodeNumber: 1, isPublished: true, hlsUrl }).errors.hlsUrl);
  }
  assert.equal(parseEpisodeInput({ episodeNumber: 1, isPublished: true, hlsUrl: 'https://cdn.example.org/master.m3u8' }).errors, null);
});
test('season validation distinguishes omitted mapping from explicit unmapping', () => {
  assert.equal(parseEpisodeInput({ episodeNumber: 1 }).data.seasonId, undefined);
  assert.equal(parseEpisodeInput({ episodeNumber: 1, seasonId: null }).data.seasonId, null);
  assert.ok(parseEpisodeInput({ episodeNumber: 1, seasonId: 'invalid' }).errors.seasonId);
  assert.ok(parseEpisodeInput({ episodeNumber: 1, seasonId: 123 }).errors.seasonId);
  assert.equal(parseEpisodeInput({ episodeNumber: 1, seasonId: '11111111-1111-4111-8111-111111111111' }).errors, null);
});
test('invalid episode number and intro windows remain rejected', () => {
  assert.ok(parseEpisodeInput({ episodeNumber: 0 }).errors.episodeNumber);
  assert.ok(parseEpisodeInput({ episodeNumber: 1, introStartSeconds: 20, introEndSeconds: 10 }).errors.introEndSeconds);
});

const { prepareEpisode } = load('src/features/content/episodes.ts');
const seasonId = '11111111-1111-4111-8111-111111111111';
const content = { type: 'series', seasons: [{ id: seasonId, seasonNumber: 2 }] };
test('season-aware creation generates distinct URLs after payload parsing', () => {
  const parsed = parseEpisodeInput({ episodeNumber: 1, seasonId }).data;
  assert.equal(prepareEpisode(parsed, content).slug, 's2-e1');
  assert.equal(prepareEpisode({ episodeNumber: 1 }, content).slug, '1');
});
test('manual season mapping and episode renumbering preserve existing URL', () => {
  assert.equal(prepareEpisode({ episodeNumber: 13, seasonId, slug: 'legacy-episode' }, content).slug, 'legacy-episode');
});
test('reject cross-content seasons and movie episode targets', () => {
  assert.throws(() => prepareEpisode({ seasonId: 'other', episodeNumber: 1 }, content), /Season must belong/);
  assert.throws(() => prepareEpisode({ episodeNumber: 1 }, { ...content, type: 'movie' }), /Movies do not support/);
});
