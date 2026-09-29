const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
module.exports = function loader(stubs = {}, env = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    vm.runInNewContext(code, {
      exports, module: { exports }, process: { env }, Request, Response, URL, URLSearchParams,
      TextDecoder, Uint8Array, Buffer, console, ...globals,
      require(name) {
        if (name === 'server-only') return {};
        if (Object.hasOwn(stubs, name)) return stubs[name];
        if (name.startsWith('@/')) return load(path.join('src', name.slice(2) + '.ts'));
        return require(name);
      }
    }, { filename: file });
    return exports;
  }
  return load;
};
