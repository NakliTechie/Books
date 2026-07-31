import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) =>
  readFileSync(new URL('../' + relative, import.meta.url), 'utf8');

const build = read('scripts/build.mjs');
const headers = read('_headers');
const workflow = read('.github/workflows/test.yml');
const config = JSON.parse(read('wrangler.jsonc'));
const app = read('index.html');

for (const asset of [
  'index.html',
  'semantic-library.js',
  'semantic-processing.js',
  'semantic-ai.js',
  'folder-library.js',
  'local-ai-sidecar.js',
  'semantic-embedding-sidecar.js',
  'idea-graph.js',
  'echoes.js',
  'open-library-metadata.js',
  'embedding-binary.js',
  'favicon.svg',
  '_headers',
]) {
  assert.match(
    build,
    new RegExp("resolve\\(projectRoot, ['\"]" +
      asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]\\)"),
    'Cloudflare build includes ' + asset,
  );
}
assert.match(
  build,
  /resolve\(projectRoot, 'vendor', 'foliate-js@1\.0\.1'\)[\s\S]*?resolve\(outputDir, 'vendor', 'foliate-js-1\.0\.1'\)/,
  'Cloudflare build publishes Foliate under a redirect-free alias',
);
assert.match(
  build,
  /resolve\(projectRoot, 'vendor', 'pdfjs-dist@5\.7\.284'\)[\s\S]*?resolve\(outputDir, 'vendor', 'pdfjs-dist-5\.7\.284'\)/,
  'Cloudflare build publishes PDF.js under a redirect-free alias',
);
assert.match(app, /const VENDOR_FOLIATE = '\.\/vendor\/foliate-js-1\.0\.1\/'/);
assert.match(app, /const VENDOR_PDFJS\s+= '\.\/vendor\/pdfjs-dist-5\.7\.284\/'/);
assert.doesNotMatch(app, /const VENDOR_(?:FOLIATE|PDFJS)[^\n]*@/);
assert.match(
  build,
  /resolve\(projectRoot, 'guide', 'index\.html'\)[\s\S]*?resolve\(projectRoot, 'guide', 'screenshots'\)/,
  'Cloudflare build includes the visual guide and its screenshots',
);

assert.equal(config.name, 'books');
assert.equal(config.assets.directory, './dist');
assert.equal(config.assets.not_found_handling, '404-page');
assert.match(config.compatibility_date, /^2026-07-/);
assert.equal(config.preview_urls, false);
assert.equal(config.send_metrics, false);
assert.equal(config.dependencies_instrumentation.enabled, false);
assert.equal(config.observability.enabled, true);
assert.ok(
  config.observability.head_sampling_rate > 0
    && config.observability.head_sampling_rate <= 0.1,
  'production observability uses a bounded sampling rate',
);

assert.match(headers, /Content-Security-Policy:/);
assert.match(headers, /object-src 'none'/);
assert.match(headers, /base-uri 'none'/);
assert.match(headers, /X-Content-Type-Options:\s*nosniff/);
assert.match(headers, /Permissions-Policy:/);
assert.match(
  headers,
  /connect-src[^;]*\bblob:/,
  'production CSP permits Foliate to fetch generated EPUB section URLs',
);
assert.match(
  headers,
  /script-src[^;]*https:\/\/cdn\.jsdelivr\.net/,
  'the pinned Transformers.js worker module has an explicit CSP source',
);
assert.match(
  headers,
  /script-src[^;]*'wasm-unsafe-eval'/,
  'the pinned ONNX runtime may compile WebAssembly inside the local AI Worker',
);
assert.match(
  headers,
  /script-src[^;]*\bblob:/,
  'the ONNX WebGPU backend may import its generated blob module',
);
assert.match(
  headers,
  /worker-src[^;]*https:\/\/cdn\.jsdelivr\.net/,
  'the module Worker may import the pinned Transformers.js runtime',
);
assert.match(
  headers,
  /img-src[^;]*https:\/\/covers\.openlibrary\.org/,
  'on-demand Open Library cover previews use one explicit image origin',
);
assert.match(headers, /workers\.dev\/\*[\s\S]*?X-Robots-Tag:\s*noindex/);

assert.match(workflow, /npm ci/);
assert.match(workflow, /npm test/);
assert.match(workflow, /npm run build/);
assert.match(workflow, /test -f dist\/semantic-ai\.js/);
assert.match(workflow, /wrangler deploy --dry-run/);

console.log('Books Cloudflare deploy artifact contract: PASS');
