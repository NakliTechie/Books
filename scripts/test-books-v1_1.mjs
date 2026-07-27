import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const harness = readFileSync(new URL('../test/host-harness.html', import.meta.url), 'utf8');

for (const [index, match] of [...html.matchAll(/<script(?:\s+type="module")?>([\s\S]*?)<\/script>/g)].entries()) {
  assert.doesNotThrow(() => new Function(match[1]), `inline Books script ${index + 1} parses`);
}
for (const [index, match] of [...harness.matchAll(/<script>([\s\S]*?)<\/script>/g)].entries()) {
  assert.doesNotThrow(() => new Function(match[1]), `host harness script ${index + 1} parses`);
}

assert.match(html, /fsBackends:\s*\[\]/, 'vendored SDK exposes connected storage backends');
assert.match(html, /fsBackend:\s*null/, 'vendored SDK exposes the active backend');
assert.match(html, /useBackend:\s*function/, 'vendored SDK supports host-mediated backend switching');
assert.match(html, /Nothing is copied or deleted/, 'storage picker explains backend isolation');
assert.match(html, /async function flushPendingWrites\(\)/, 'backend switching can await reading-state writes');
assert.match(
  html,
  /\.drop-overlay\s*\{[\s\S]*?display:\s*none[\s\S]*?\.drop-overlay:not\(\[hidden\]\)\s*\{\s*display:\s*flex/,
  'drop overlay must be hidden unless a file drag explicitly reveals it',
);
assert.match(
  html,
  /function enterReaderView\(filename\)[\s\S]*?hideDropOverlay\(\)/,
  'entering the reader must clear any stale drag overlay state',
);

assert.match(html, /id="library-filter"/, 'library includes a filter');
assert.match(html, /id="library-sort"/, 'library includes a sort chooser');
assert.match(html, /removeBookFromLibrary/, 'library supports deliberate removal');
assert.match(html, /askForConfirmation/, 'book removal uses an in-app confirmation dialog');
assert.doesNotMatch(
  html,
  /removeBookFromLibrary[\s\S]{0,1500}\bconfirm\s*\(/,
  'book removal must not use the browser confirm popup',
);
assert.match(
  html,
  /exists\('library\/'\s*\+\s*f\.name\)/,
  'adding a book checks for an existing filename first',
);
assert.match(html, /already in this library\. Remove it first/, 'duplicate adds refuse silent overwrite');

for (const id of [
  'reader-font-size',
  'reader-line-height',
  'reader-page-width',
  'reader-profile',
]) {
  assert.match(html, new RegExp(`id="${id}"`), `reader preference control ${id} exists`);
}
assert.match(html, /readerPrefs:\s*null/, 'new sidecars support per-book reader preferences');
assert.match(html, /activeSidecar\.readerPrefs/, 'reader preferences persist into the active sidecar');
assert.match(html, /applyPreferences\(prefs\)/, 'reader engines implement preference application');
assert.match(html, /PDFs retain their authored page layout/, 'PDF preference behavior is explicit');
assert.match(harness, /fsa:\s*new Map/, 'browser fixture provides an isolated Folder library');
assert.match(harness, /crate:\s*new Map/, 'browser fixture provides an isolated Crate library');

console.log('Books v1.1 storage and library contract: PASS');
