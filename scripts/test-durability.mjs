// DUR (2026-09-24): Lorewell's sidecar writes ride naklios.fs.autosave (docs/app-contract.md
// "Durability" in NakliTechie/nakli-dev). They used to be a 1 s timer per book plus a sync flush wired
// to beforeunload (which cannot complete a write) and to beforeClose (without returning its promise,
// so the host never waited). A failed flush put nothing back; it now re-queues unless newer state won.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const app = html.replace(/\/\* naklios-sdk:begin[\s\S]*?naklios-sdk:end \*\//, '');
assert.notEqual(app, html, 'the vendored SDK block was found and stripped');
assert.match(html, /autosave: function \(opts\)/, 'the vendored SDK carries naklios.fs.autosave');
assert.match(app, /naklios\.fs\.autosave\(\{ save: flushPendingWrites, delay: 1000, guard: false \}\)/, 'the SDK owns the timing; a page turn never arms a close prompt');
assert.match(app, /function writeSidecarDebounced\(bookId, data\) \{\n  pendingWrites\.set\(bookId, \{ data \}\);\n  sidecarSaver\(\)\.markDirty\(\);/, 'every sidecar change reaches the autosave');
assert.match(app, /if \(!pendingWrites\.has\(bookId\)\) pendingWrites\.set\(bookId, \{ data \}\);/, 'a failed write is re-queued unless newer state was queued');
assert.doesNotMatch(app, /flushPendingWritesSync/, 'the unawaitable sync flush is gone');
assert.doesNotMatch(app, /addEventListener\('beforeunload', flushPending/, 'no save in beforeunload');
console.log('Lorewell durability: sidecar writes ride naklios.fs.autosave; failed writes re-queue');
