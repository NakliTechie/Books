import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) =>
  readFileSync(new URL('../' + relative, import.meta.url), 'utf8');

const build = read('scripts/build.mjs');
const headers = read('_headers');
const workflow = read('.github/workflows/test.yml');
const config = JSON.parse(read('wrangler.jsonc'));

for (const asset of [
  'index.html',
  'semantic-library.js',
  'semantic-processing.js',
  'semantic-ai.js',
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
  /cp\(resolve\(projectRoot, 'vendor'\)[\s\S]*?recursive:\s*true/,
  'Cloudflare build includes the pinned local reader dependencies',
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
assert.match(headers, /workers\.dev\/\*[\s\S]*?X-Robots-Tag:\s*noindex/);

assert.match(workflow, /npm ci/);
assert.match(workflow, /npm test/);
assert.match(workflow, /npm run build/);
assert.match(workflow, /test -f dist\/semantic-ai\.js/);
assert.match(workflow, /wrangler deploy --dry-run/);

console.log('Books Cloudflare deploy artifact contract: PASS');
