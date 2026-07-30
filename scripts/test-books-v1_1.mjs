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

assert.match(
  html,
  /standaloneFsAvailable\s*=\s*!inNakliOS\s*&&\s*typeof indexedDB !== 'undefined'/,
  'standalone mode detects persistent browser storage',
);
assert.match(
  html,
  /fsBackends:\s*standaloneFsAvailable\s*\?\s*\['browser'\]\s*:\s*\[\]/,
  'standalone mode exposes its Browser storage backend',
);
assert.match(
  html,
  /fsBackend:\s*standaloneFsAvailable\s*\?\s*'browser'\s*:\s*null/,
  'standalone mode selects Browser storage',
);
assert.match(html, /indexedDB\.open\(STANDALONE_DB_NAME,\s*1\)/,
  'standalone library opens a versioned IndexedDB filesystem');
assert.match(html, /standaloneReadBinary[\s\S]*?standaloneWrite[\s\S]*?standaloneList/,
  'standalone filesystem supports binary books and directory scans');
assert.match(html, /id === 'browser' \|\| id === 'fsa' \|\| id === 'crate'/,
  'Books recognizes Browser, Folder, and Crate backends');
assert.match(html, /requestStandalonePersistence\(\)/,
  'standalone adds request durable browser storage when available');
assert.match(html, /useBackend:\s*function/, 'vendored SDK supports host-mediated backend switching');
assert.match(html, /ai:\s*false/, 'vendored SDK exposes Local AI capability state');
assert.match(html, /chat:\{\s*completions:\{\s*create:createAiCompletion/, 'vendored SDK exposes streamed chat completions');
assert.match(html, /beforeCloseAck:true,\s*aiStream:true/, 'Books advertises close durability and AI streaming');
assert.match(html, /openSettings:\s*function/, 'vendored SDK can open trusted NakliOS settings');
assert.match(html, /Open Storage settings…/, 'disconnected Books offers a direct storage recovery action');
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
assert.match(html, /id="reader-searchbar"/, 'reader includes an in-book search surface');
assert.match(html, /id="reader-ai-btn"/, 'reader exposes Local AI only in reading mode');
assert.match(html, /id="reader-ai-dialog"/, 'reader has an app-styled Local AI review dialog');
assert.match(html, /Find in book \(⌘F\)/, 'reader advertises the standard search shortcut');
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
assert.match(html, /coverPath:\s*null/, 'new sidecars track a backend-local cached cover');
assert.match(html, /covers\/' \+ activeBookId|covers\/' \+ bookId/,
  'cover thumbnails are written to the Books namespace');
assert.match(html, /makeCoverThumbnail\(source\)/,
  'format covers are resized before caching when the browser can decode them');
assert.match(
  html,
  /const isCurrent = \(\) =>[\s\S]*?token === coverWriteTokens\.get\(bookId\)[\s\S]*?backendId === activeBackendId\(\)/,
  'late cover extraction must not cross a removed book or backend switch',
);
assert.match(html, /clearCoverObjectUrls\(\)/,
  'cover blob URLs have an explicit storage-switch and teardown cleanup path');
assert.match(html, /engine\.getCover\?\.\(\)/,
  'cover extraction stays behind the common engine interface');
assert.match(html, /this\.view\?\.book\?\.getCover\?\.\(\)/,
  'Foliate formats use their package cover');
assert.match(html, /canvas\[data-page-num="1"\]/,
  'PDF covers use the rendered first page');
assert.match(html, /class="book-cover/,
  'library rows render visual cover slots with a stable fallback');
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
for (const method of [
  'async search(query)',
  'async jumpToSearchResult(result)',
  'clearSearch()',
]) {
  assert.ok(html.includes(method), `reader engines expose ${method}`);
}
assert.equal(
  [...html.matchAll(/async getContextText\(maxChars = 12000\)/g)].length,
  3,
  'every reader engine provides bounded passage context',
);
assert.match(html, /doc\?\.getSelection\?\.\(\)\?\.toString/, 'EPUB context prefers the visible selection');
assert.match(html, /scope:`page \$\{this\.currentPage \|\| 1\}`/, 'PDF context names and extracts the current page');
assert.match(html, /window\.getSelection\?\.\(\)/, 'text context prefers the visible selection');
assert.match(html, /You are the private reading companion inside NakliOS Books/,
  'reading prompts are passage-scoped and disclose model limits');
assert.match(html, /readerAiController\?\.abort\(\)/, 'reader generation can be cancelled');
assert.match(html, /const iterator = this\.view\.search[\s\S]*?for await \(const item of iterator\)/,
  'Foliate search uses its CFI-aware full-book search');
assert.match(html, /await page\.getTextContent\(\)/,
  'PDF search extracts authored text page by page');
assert.match(html, /this\.searchText\.toLocaleLowerCase\(\)/,
  'plain-text search uses the loaded document text');
assert.match(html, /await activeEngine\.jumpToSearchResult\?\.\(result\)/,
  'cycling matches jumps through the active engine adapter');
assert.match(html, /\(e\.metaKey \|\| e\.ctrlKey\) && e\.key\.toLowerCase\(\) === 'f'/,
  'Cmd/Ctrl+F opens Books search instead of browser find');
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
assert.match(harness, /properties="cover-image"/,
  'real EPUB fixture includes a package-declared cover');
assert.match(
  harness,
  /reader-search-input[\s\S]*?deterministic[\s\S]*?reader-search-count[\s\S]*?1 of/,
  'browser harness searches the real EPUB and observes a result');
assert.ok(harness.includes('^covers\\/Harness-[a-z0-9-]+\\.cover$'),
  'browser harness proves the EPUB cover reaches hosted storage');
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

console.log('Books persistent storage and library contract: PASS');
