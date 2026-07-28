import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const harness = readFileSync(new URL('../test/host-harness.html', import.meta.url), 'utf8');
const paginator = readFileSync(
  new URL('../vendor/foliate-js@1.0.1/paginator.js', import.meta.url),
  'utf8',
);

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
assert.match(html, /scrollbar-color:\s*var\(--line\)\s*transparent/, 'Books scrollbars use its active theme');
assert.match(html, /id="reader-library"/, 'reader keeps the library visible in a sidebar');
assert.match(html, /id="reader-library-list"/, 'reader sidebar includes the library contents');
assert.match(html, /id="reader-open-file"/, 'reader includes an explicit file-open control');
assert.match(html, /function renderReaderLibrary\(\)/, 'reader library can refresh without leaving the book');
assert.match(
  html,
  /readerLibraryList\.addEventListener\('click'[\s\S]*?openBookFromLibrary\(filename\)/,
  'reader library switches directly between persisted books',
);
assert.match(html, /removeBookFromLibrary/, 'library supports deliberate removal');
assert.match(html, /askForConfirmation/, 'book removal uses an in-app confirmation dialog');
assert.doesNotMatch(
  html,
  /removeBookFromLibrary[\s\S]{0,1500}\bconfirm\s*\(/,
  'book removal must not use the browser confirm popup',
);
assert.match(html, /id="bookmark-label-dialog"/, 'bookmark renaming has an app-styled dialog');
assert.match(html, /function askForBookmarkLabel\(/, 'bookmark label dialog has a promise-based adapter');
assert.match(
  html,
  /bookmarkLabelInput\.addEventListener\('keydown'[\s\S]*?event\.key !== 'Enter'[\s\S]*?bookmarkLabelDialog\.close\('save'\)/,
  'Enter in the bookmark label field saves instead of activating Cancel',
);
assert.doesNotMatch(html, /\bprompt\s*\(/, 'Books must not use the browser prompt popup');
assert.match(
  html,
  /exists\('library\/'\s*\+\s*f\.name\)/,
  'adding a book checks for an existing filename first',
);
assert.match(html, /already in this library\. Remove it first/, 'duplicate adds refuse silent overwrite');
assert.match(html, /id="continue-section"/, 'library includes a Continue Reading rail');
assert.match(
  html,
  /filter\(\(entry\) => entry\.sidecar && entry\.sidecar\.lastOpened\)[\s\S]*?slice\(0, 5\)/,
  'Continue Reading is derived from persisted last-opened sidecars',
);
assert.match(html, /id="orphan-section"/, 'library has a dedicated orphan-sidecar recovery area');
assert.match(
  html,
  /orphanSidecars = sidecarRows\.filter\([\s\S]*?!bookNames\.has\(entry\.sidecar\.sourceFilename\)/,
  'missing book files leave their sidecars visible instead of discarding them',
);
assert.match(
  html,
  /file\.name !== expected[\s\S]*?Reading data was not rebound/,
  'orphan recovery refuses a differently named book without rebinding reading data',
);
assert.match(
  html,
  /recoverOrphanWithFile[\s\S]*?noteFilename\.slice[\s\S]*?fs\.write\('library\/' \+ expected[\s\S]*?openBookFromLibrary\(expected, bookId\)/,
  'recovering the exact book carries the existing sidecar identity into the reader',
);
assert.match(
  html,
  /preferredSidecar\.sourceFilename !== filename[\s\S]*?selected reading data no longer matches/,
  'the reader validates a recovered sidecar before using its identity',
);

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
assert.match(
  html,
  /withTimeout\([\s\S]*?this\.view\.init\(\{ showTextStart: true \}\)[\s\S]*?first EPUB page did not finish rendering/,
  'EPUB startup has a bounded, visible failure path',
);
assert.doesNotMatch(
  html,
  /try\s*\{\s*await this\.view\.init\([\s\S]{0,180}catch\s*\(_\)\s*\{\s*try\s*\{\s*await this\.view\.next/,
  'EPUB startup errors must not be swallowed into a blank reader',
);
assert.match(
  paginator,
  /src\.startsWith\('blob:'\)[\s\S]*?\(\?:xhtml\|html\)[\s\S]*?srcdoc\s*=\s*await response\.text\(\)[\s\S]*?this\.#iframe\.srcdoc\s*=\s*srcdoc/,
  'vendored paginator uses srcdoc for XHTML blob sections that Chromium may leave pending',
);
assert.match(harness, /fsa:\s*new Map/, 'browser fixture provides an isolated Folder library');
assert.match(harness, /crate:\s*new Map/, 'browser fixture provides an isolated Crate library');
assert.match(harness, /\['library\/Harness\.epub',\s*minimalEpub\(\)\]/, 'browser fixture provides a real binary EPUB path');
assert.match(harness, /function storedZip\(entries\)/, 'minimal EPUB is assembled as a deterministic ZIP archive');
assert.match(harness, /function runEpubRegression\(\)/, 'browser harness exposes an EPUB regression run');
assert.match(harness, /sourceFilename:\s*'Missing\.epub'/, 'browser fixture seeds an orphaned sidecar');
assert.match(
  harness,
  /getElementById\('next-btn'\)[\s\S]*?next\.click\(\)[\s\S]*?prev\.click\(\)[\s\S]*?next\.click\(\)/,
  'browser harness exercises Next, Previous, then an advanced page',
);
assert.match(
  harness,
  /positionFromStore\(\)[\s\S]*?back-btn[\s\S]*?reopenedRow\.click\(\)[\s\S]*?hosted EPUB position restoration/,
  'browser harness proves hosted sidecar persistence by closing and reopening the EPUB',
);
assert.match(
  harness,
  /#continue-section \[data-continue-filename="Harness\.epub"\][\s\S]*?#orphan-section \[data-recover-sidecar="missing-book\.json"\]/,
  'browser harness proves Continue Reading and orphan recovery render after the EPUB flow',
);
assert.match(
  harness,
  /chooseRecoveryFile\('Wrong\.epub'\)[\s\S]*?Reading data was not rebound[\s\S]*?chooseRecoveryFile\('Missing\.epub'\)[\s\S]*?must survive[\s\S]*?Keep this place/,
  'browser harness refuses mismatches and proves the exact book reuses its note and bookmark',
);
assert.match(
  harness,
  /has\('notes\/missing-book\.json'\)[\s\S]*?has\('notes\/Missing\.json'\)/,
  'browser harness rejects silent sidecar rebinding after recovery',
);

console.log('Books v1.1 storage and library contract: PASS');
