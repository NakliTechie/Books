import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const harness = readFileSync(new URL('../test/host-harness.html', import.meta.url), 'utf8');
const paginator = readFileSync(
  new URL('../vendor/foliate-js@1.0.1/paginator.js', import.meta.url),
  'utf8',
);

for (const [index, match] of [...html.matchAll(/<script(?:\s+type="module")?>([\s\S]*?)<\/script>/g)].entries()) {
  const parseable = match[1].replace(
    /import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];\s*/g,
    '',
  );
  assert.doesNotThrow(() => new Function(parseable), `inline Books script ${index + 1} parses`);
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
assert.match(html, /indexedDB\.open\(STANDALONE_DB_NAME,\s*STANDALONE_DB_VERSION\)/,
  'standalone library opens a versioned IndexedDB filesystem');
assert.match(html, /STANDALONE_DB_VERSION\s*=\s*2/,
  'standalone storage schema includes remembered folder handles');
assert.match(html, /async function standaloneConnectFolder\(/,
  'standalone mode can connect a user-granted folder library');
assert.match(html, /async function standaloneFolderWalkSources\(/,
  'folder libraries recursively discover supported source books');
assert.match(
  html,
  /STANDALONE_FOLDER_SIDECAR\s*=\s*'\.books'[\s\S]*?canonicalMetadata:'sidecar'/,
  'folder libraries reserve a durable Books-owned sidecar',
);
assert.match(html, /function persistStandaloneFolderInventory\(/,
  'standalone folder scans persist versioned inventory records');
assert.match(html, /standaloneReadBinary[\s\S]*?standaloneWrite[\s\S]*?standaloneList/,
  'standalone filesystem supports binary books and directory scans');
assert.match(html, /id === 'browser' \|\| id === 'fsa' \|\| id === 'crate'/,
  'Books recognizes Browser, Folder, and Crate backends');
assert.match(html, /requestStandalonePersistence\(\)/,
  'standalone adds request durable browser storage when available');
assert.match(html, /from '\.\/semantic-library\.js'/,
  'Books loads the shared semantic-library domain model');
assert.match(html, /from '\.\/semantic-processing\.js'/,
  'Books loads the shared local processing pipeline');
assert.match(html, /id="work-processing-cancel-btn"/,
  'per-work processing can be cancelled and resumed');
assert.match(html, /id="work-connections-section"/,
  'book details expose evidence-linked ideas across the library');
assert.match(html, /recoverStandaloneFolderRename/,
  'standalone Folder mode preserves work identity through strong-hash renames');
assert.match(html, /async function ensureSemanticFoundation\(/,
  'library scans reconcile portable work manifests');
assert.match(html, /async function syncPortableAnnotationsForManifest\(/,
  'legacy reading data migrates into portable work annotations');
assert.match(
  html,
  /write\('notes\/' \+ bookId[\s\S]*?syncPortableAnnotationsForSidecar\(data\)/,
  'sidecar durability is followed by portable annotation synchronization',
);
assert.match(
  html,
  /for \(const manifest of result\.changedManifests\)[\s\S]*?if \(result\.catalogChanged\)/,
  'canonical work manifests are persisted before the rebuildable catalog',
);
assert.match(
  html,
  /semantic catalog unavailable; using source scan/,
  'catalog failure preserves the faithful source-scan reader fallback',
);
assert.match(html, /async function extractSectionsForAsset\(/,
  'background processing uses format-aware parsers');
assert.match(
  html,
  /error\.code = 'ocr-required'[\s\S]*?waiting-for-ocr/,
  'image-only PDFs report an explicit OCR requirement',
);
assert.match(
  html,
  /function scheduleSemanticProcessing\(\)[\s\S]*?setTimeout[\s\S]*?runSemanticProcessingQueue/,
  'semantic work is scheduled after reading readiness instead of blocking scans',
);
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
assert.match(
  html,
  /Search titles, authors, and inside books[\s\S]*?id="library-options"/,
  'library keeps one primary search and progressively discloses organization tools',
);
assert.match(html, /id="library-sort"/, 'library includes a sort chooser');
assert.match(html, /id="library-view-select"/,
  'library includes deterministic smart-view and facet selection');
assert.match(html, /id="saved-view-dialog"/,
  'query-driven views use an app-styled portable save surface');
assert.match(
  html,
  /function libraryViewMatches\([\s\S]*?readingState === 'continue'[\s\S]*?readingState === 'annotated'[\s\S]*?filters\.shelves[\s\S]*?filters\.tags/,
  'smart views cover reading state, annotations, shelves, and tags without embeddings',
);
assert.match(
  html,
  /SEMANTIC_VIEWS_PATH[\s\S]*?upsertLibraryView[\s\S]*?persistLibraryViews/,
  'saved views are portable records in the active storage backend',
);
assert.match(
  html,
  /async function mutateSemanticManifest\(workId, mutate\)[\s\S]*?semanticManifestMutationTails[\s\S]*?updateWorkDetails\(latest, values\)[\s\S]*?updateAssetFingerprint\(latest, asset\.assetId/,
  'user metadata and background fingerprints mutate the latest manifest serially',
);
assert.match(html, /id="semantic-search-results"/,
  'the unified library search includes local passage results');
assert.match(html, /async function runSemanticLibrarySearch\(/,
  'library full-text search reads its offline per-work indexes');
assert.match(
  html,
  /semanticLibraryQuery = libraryFilter[\s\S]*?id="library-filter"[\s\S]*?runSemanticLibrarySearch\(semanticLibraryQuery\)/,
  'semantic search survives a background library reconciliation rerender',
);
assert.match(
  html,
  /searchLexicalIndex\(index, normalized\)[\s\S]*?data-semantic-result/,
  'library full-text results retain navigable passage identities',
);
assert.match(
  html,
  /async function openSemanticSearchResult\([\s\S]*?activeEngine\.jumpTo/,
  'library full-text results jump back to a faithful reader anchor',
);
assert.match(html, /id="work-details-dialog"/,
  'portable work metadata has an app-styled editor');
assert.match(html, /function openWorkDetails\(/,
  'work details load portable metadata and local processing state');
assert.match(html, /from '\.\/open-library-metadata\.js'/,
  'Books loads its bounded Open Library metadata adapter');
assert.match(html, /id="work-isbn-input"/,
  'portable work metadata can retain a user-entered ISBN');
assert.match(
  html,
  /function validatedWorkIsbnInput\(\)[\s\S]*?normalizeIsbn\(submitted\)[\s\S]*?Enter a valid ISBN-10 or ISBN-13/,
  'the editor rejects invalid ISBN check digits before changing portable metadata',
);
assert.match(html, /id="work-open-library-lookup"/,
  'book details expose explicit per-work metadata lookup');
assert.match(html, /id="work-metadata-results"/,
  'metadata suggestions render inside the current work editor');
assert.match(
  html,
  /Optional and on demand[\s\S]*?Never runs across the whole library/,
  'Open Library disclosure says exactly what leaves the device and rejects bulk lookup',
);
assert.match(
  html,
  /workOpenLibraryLookup\.addEventListener\('click'[\s\S]*?lookupWorkMetadata/,
  'Open Library network lookup starts only from an explicit click',
);
assert.match(
  html,
  /Apply missing metadata[\s\S]*?Use this cover/,
  'metadata and cover adoption remain separate explicit actions',
);
assert.match(
  html,
  /View on Open Library ↗[\s\S]*?persistMetadataCandidate/,
  'provider results retain a courtesy link and portable provenance',
);
assert.match(
  html,
  /updateWorkDetails\(latest, values\)[\s\S]*?portable-metadata-changed[\s\S]*?scheduleSemanticProcessing/,
  'metadata edits persist canonically and refresh affected search metadata',
);
assert.match(html, /id="add-highlight-btn"/,
  'reader sidebar can create portable selection highlights');
assert.match(html, /id="highlight-dialog"/,
  'highlight color and note use an app-styled dialog');
assert.match(
  html,
  /sourceGroundSelectionTarget[\s\S]*?addPortableAnnotation[\s\S]*?persistActiveAnnotations/,
  'new highlights are source-grounded and written to portable annotations',
);
assert.match(html, /id="annotations-browser-dialog"/,
  'portable annotations have a library-wide browser');
assert.match(html, /function openAnnotationsBrowser\(/,
  'library-wide annotation browsing reads per-work portable records');
assert.match(html, /function exportLibraryAnnotations\(/,
  'annotations export to a documented human-readable Markdown form');
assert.match(html, /id="library-tools-dialog"/,
  'the library exposes validation, rebuild, export, and import controls');
assert.match(
  html,
  /function validateActiveLibrary\([\s\S]*?validateSemanticLibrary\([\s\S]*?catalog:\s*semanticCatalog/,
  'library validation compares canonical records with the rebuildable catalog',
);
assert.match(
  html,
  /function rebuildActiveCatalog\([\s\S]*?SEMANTIC_CATALOG_PATH[\s\S]*?report\.rebuiltCatalog/,
  'catalog repair writes only the catalog rebuilt from canonical manifests',
);
assert.match(
  html,
  /function exportPortableLibrary\([\s\S]*?readBinary\('library\/' \+ filename\)[\s\S]*?createPortableBundle/,
  'portable export includes original source bytes and canonical records',
);
assert.match(
  html,
  /function importPortableLibraryFile\([\s\S]*?validatePortableBundle\([\s\S]*?Import stopped before any writes/,
  'portable import validates and preflights conflicts before changing storage',
);
assert.match(
  html,
  /await askForConfirmation\([\s\S]*?for \(const \{ asset, bytes \} of decodedAssets\)/,
  'portable import requires confirmation before its idempotent write phase',
);
assert.match(
  html,
  /reanchorPortableAnnotations[\s\S]*?activeAnnotationRecord = reanchored\.record/,
  'passage upgrades re-anchor annotations or expose unresolved state',
);
assert.match(
  html,
  /class FoliateEngine[\s\S]*?getSelectionTarget\(\)[\s\S]*?foliate-cfi[\s\S]*?renderAnnotations/,
  'Foliate highlights retain CFI selectors and restore as overlays',
);
assert.match(
  html,
  /resolveCFI\(position\.cfi\)[\s\S]*?resolved\.anchor\(document\)[\s\S]*?goToFraction\(position\.fraction\)/,
  'stale EPUB CFIs are preflighted before falling back to a durable fraction',
);
assert.match(
  html,
  /class PdfEngine[\s\S]*?pdf-text-layer[\s\S]*?kind:'pdf-text'[\s\S]*?pdf-highlight-overlay/,
  'PDF highlights retain page text ranges and normalized rectangles',
);
assert.match(
  html,
  /class TextEngine[\s\S]*?kind:'text-offset'[\s\S]*?renderAnnotations/,
  'plain-text highlights retain portable offsets and restore inline',
);
assert.match(html, /scrollbar-color:\s*var\(--line\)\s*transparent/, 'Books scrollbars use its active theme');
assert.match(html, /id="reader-library"/, 'reader includes an on-demand library pane');
assert.match(html, /id="reader-library-toggle"/,
  'reader exposes the library pane from its top bar');
assert.match(
  html,
  /function setReaderLibraryOpen\([\s\S]*?toggleAttribute\('inert'[\s\S]*?READER_LIBRARY_OPEN_KEY/,
  'reader library collapse is accessible and remembers the user preference',
);
assert.match(html, /id="reader-library-list"/, 'reader sidebar includes the library contents');
assert.match(html, /id="reader-open-file"/, 'reader includes an explicit file-open control');
assert.match(html, /id="reader-searchbar"/, 'reader includes an in-book search surface');
assert.match(
  html,
  /function queueReaderNavigation\(method\)[\s\S]*?readerNavigationTail[\s\S]*?queueReaderNavigation\('next'\)/,
  'reader navigation serializes rapid page turns instead of dropping them',
);
assert.match(html, /id="reader-ai-btn"/, 'reader exposes Local AI only in reading mode');
assert.match(html, /id="reader-ai-sidecar"/,
  'reader has a persistent app-styled Local AI sidecar');
assert.match(
  html,
  /id="reader-ai-context-bar"[\s\S]*?id="reader-ai-provider-summary"/,
  'reader AI leads with compact reading context and defers provider details',
);
assert.doesNotMatch(
  html,
  /id="reader-ai-local-(?:load|model)"/,
  'reader AI does not spend its task surface on model infrastructure',
);
assert.match(
  html,
  /function refreshReaderAiContext[\s\S]*?engine\.getContextText\(12000\)[\s\S]*?resetReaderAiAnswerForContextChange\(/,
  'reader AI refreshes context and invalidates an answer when the page changes',
);
assert.match(
  html,
  /class FoliateEngine[\s\S]*?lastLocation\?\.range\?\.toString\?\.\(\)[\s\S]*?scope:'current page'/,
  'EPUB AI context is the visible pagination range rather than the whole spine section',
);
assert.match(
  html,
  /e\.altKey && \(e\.key === 'ArrowRight' \|\| e\.key === 'ArrowLeft'\)[\s\S]*?queueReaderNavigation/,
  'AI text entry retains an explicit page-navigation shortcut',
);
assert.match(html, /id="ai-provider-dialog"/,
  'standalone mode has a visible local/BYOK provider configuration surface');
assert.match(html, /id="library-ask-dialog"/,
  'the library has a source-grounded Ask surface');
assert.match(html, /id="library-ask-btn"/,
  'work-centered library controls expose Ask without entering a reader');
assert.match(html, /id="work-enrich-btn"/,
  'book details expose explicit on-demand semantic enrichment');
assert.match(html, /id="concept-curation-dialog"/,
  'generated concepts have an app-styled portable curation surface');
assert.match(
  html,
  /curateSemanticConcepts\([\s\S]*?data-concept-id[\s\S]*?updateConceptCuration\(/,
  'work details apply portable rename, hide, merge, and split overrides',
);
assert.match(
  html,
  /curatedNativeSemanticRecord[\s\S]*?curateSemanticConcepts\([\s\S]*?new NativeEngine/,
  'Native reading applies portable concept curation to derived records',
);
assert.match(html, /id="work-formats"/,
  'work details expose every available source format');
assert.match(html, /id="work-split-btn"/,
  'user-confirmed format grouping has an explicit reverse action');
assert.match(
  html,
  /AI_PROVIDER_CONFIG_KEY[\s\S]*?localStorage\.setItem\(AI_PROVIDER_CONFIG_KEY[\s\S]*?AI_PROVIDER_SESSION_KEY[\s\S]*?sessionStorage\.setItem/,
  'provider identity persists locally while credentials remain session-only',
);
assert.match(
  html,
  /config\.providerClass === 'remote'[\s\S]*?!aiRemoteConsent\.checked[\s\S]*?makeProviderConsent\(config,[\s\S]*?'answerFromSources'[\s\S]*?'extractConcepts'[\s\S]*?'extractScenes'/,
  'remote BYOK capabilities require destination-specific consent',
);
assert.match(
  html,
  /function retrieveAskSources\([\s\S]*?searchLexicalIndex[\s\S]*?semanticAnnotationsPath/,
  'Ask retrieves local passage and annotation evidence before inference',
);
assert.match(
  html,
  /runWorkSemanticEnrichment[\s\S]*?resolveAiProvider\('extractConcepts'\)[\s\S]*?buildSemanticEnrichmentMessages[\s\S]*?parseSemanticEnrichment[\s\S]*?mergeModelSemanticRecords[\s\S]*?all-records-have-valid-passage-evidence/,
  'on-demand semantic enrichment is capability-gated, parsed, grounded, and recorded',
);
assert.match(
  html,
  /groupSuggestedWorks[\s\S]*?Group formats[\s\S]*?mergeWorkManifests[\s\S]*?mergePortableAnnotationRecords/,
  'validation suggestions support confirmed, annotation-preserving work grouping',
);
assert.match(
  html,
  /splitGroupedWork[\s\S]*?splitWorkManifests[\s\S]*?splitPortableAnnotationRecords/,
  'grouped formats can be split without changing original assets',
);
assert.match(
  html,
  /function workCenteredLibraryEntries[\s\S]*?groupedEntries[\s\S]*?formats/,
  'the visible library collapses grouped formats into one work-centered row',
);
assert.match(
  html,
  /reader-font-family[\s\S]*?reader-text-align[\s\S]*?reader-paragraph-spacing/,
  'reflow controls include typeface, justification, and paragraph spacing',
);
assert.match(
  html,
  /prefers-reduced-motion:\s*reduce[\s\S]*?preferredScrollBehavior/,
  'reader motion follows the operating-system reduced-motion preference',
);
assert.match(
  html,
  /class NativeEngine[\s\S]*?role', 'document'[\s\S]*?native-fallback-notice[\s\S]*?native-concepts[\s\S]*?aria-current[\s\S]*?minutesRemaining/,
  'Native mode exposes landmarks, fallbacks, concepts, references, and time remaining',
);
assert.match(
  html,
  /library-storage-accounting[\s\S]*?processing-toggle-btn[\s\S]*?derived-clear-btn/,
  'library tools expose storage accounting, processing pause, and derived cleanup',
);
assert.match(
  html,
  /storageAccountingSnapshot[\s\S]*?Original sources[\s\S]*?Portable records[\s\S]*?Semantic \+ AI[\s\S]*?Clear local derived data/,
  'storage lifecycle separates canonical, user-owned, and rebuildable data',
);
assert.match(
  html,
  /navigator\.storage\?\.estimate[\s\S]*?navigator\.storage\.estimate\(\)[\s\S]*?Browser origin/,
  'standalone storage tools surface browser origin usage and quota when available',
);
assert.match(
  html,
  /buildGroundedMessages\([\s\S]*?runAiMessages\([\s\S]*?validateGroundedAnswer\([\s\S]*?persistAiRun\(makeAiRunRecord/,
  'Ask validates cited responses and records provider/evidence provenance',
);
assert.match(
  html,
  /function openAskCitation\([\s\S]*?openBookFromLibrary[\s\S]*?faithfulPositionForPassage/,
  'AI citations navigate back to the faithful source passage',
);
assert.doesNotMatch(
  html,
  /naklios\.fs\.write\([\s\S]{0,200}AI_PROVIDER_SESSION_KEY/,
  'provider credentials are never written to library storage',
);
assert.match(html, /Find in book \(⌘F\)/, 'reader advertises the standard search shortcut');
assert.match(html, /id="welcome-dialog"[\s\S]*?A private semantic library/,
  'first run explains the private semantic library thesis');
assert.match(html, /href="guide\/"[\s\S]*?href="guide\/#active-reader"/,
  'Help links the library and reader to the shipped guide');
assert.match(html, /<main class="main"[\s\S]*?<main class="reader-stage"/,
  'library and reader expose visible-state main landmarks');
assert.match(html, /rel="icon" href="favicon\.svg"/,
  'Books ships an explicit favicon');
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
assert.match(html, /id="trash-list"/,
  'library tools expose recoverable Trash');
assert.match(
  html,
  /removeBookFromLibrary[\s\S]*?write\(paths\.source[\s\S]*?write\(paths\.item[\s\S]*?delete\('library\/' \+ filename\)[\s\S]*?markAssetTrashed/,
  'removal preserves the original and a recovery record before deleting the live source',
);
assert.match(
  html,
  /function restoreTrashRecord\([\s\S]*?already exists[\s\S]*?restoreTrashedAsset[\s\S]*?cleanupTrashCopies/,
  'Trash restore refuses overwrite, restores canonical identity, then cleans its copy',
);
assert.match(
  html,
  /function permanentlyDeleteTrashRecord\([\s\S]*?Delete this book forever[\s\S]*?removeTrashedAsset/,
  'permanent deletion is a separate confirmed endpoint',
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
  4,
  'every reader engine provides bounded passage context',
);
assert.match(html, /id="reader-mode-btn"/,
  'reader exposes an explicit Faithful and Native mode switch');
assert.match(html, /class NativeEngine/,
  'Books-native reading has a dedicated passage renderer');
assert.match(
  html,
  /class NativeEngine[\s\S]*?dataset\.passageId[\s\S]*?View authored source/,
  'every native passage retains a visible route to its authored source',
);
assert.match(
  html,
  /function switchToNativeMode\([\s\S]*?activeSidecar\.nativePosition/,
  'native reading persists its position separately from faithful position',
);
assert.match(
  html,
  /function switchToFaithfulMode\(sourcePassage[\s\S]*?faithfulPositionForPassage/,
  'native source links translate back to faithful engine anchors',
);
assert.match(
  html,
  /nativeAvailable[\s\S]*?activeSidecar\?\.preferredMode === 'native'[\s\S]*?switchToNativeMode/,
  'a persisted Native mode preference is restored after reopening a book',
);
assert.match(html, /doc\?\.getSelection\?\.\(\)\?\.toString/, 'EPUB context prefers the visible selection');
assert.match(html, /scope:`page \$\{this\.currentPage \|\| 1\}`/, 'PDF context names and extracts the current page');
assert.match(html, /window\.getSelection\?\.\(\)/, 'text context prefers the visible selection');
assert.match(
  html,
  /You are the private reading companion inside Lorewell[\s\S]*?untrusted quoted[\s\S]*?do not[\s\S]*?claim to have read the rest of the book/,
  'reading prompts are passage-scoped, injection-aware, and disclose model limits',
);
assert.match(html, /readerAiController\?\.abort\(\)/, 'reader generation can be cancelled');
assert.match(
  html,
  /activeReaderAiSourceRef[\s\S]*?READER_PROMPT_VERSION[\s\S]*?single-passage-boundary/,
  'reader AI writes evidence-linked provenance records',
);
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
assert.match(
  harness,
  /jsonFromStore\('catalog\/catalog\.json'\)[\s\S]*?aliases\.sourceFilenames\['Harness\.epub'\]/,
  'browser harness verifies portable work catalog migration',
);
assert.match(
  harness,
  /jsonFromStore\('annotations\/' \+ recoveredWorkId \+ '\.json'\)[\s\S]*?annotation\.kind === 'note'[\s\S]*?annotation\.kind === 'bookmark'/,
  'browser harness verifies recovered notes and bookmarks become portable annotations',
);
assert.match(
  harness,
  /jobs\/' \+ sampleWorkId[\s\S]*?deterministicSemantics[\s\S]*?semantic\/' \+ sampleWorkId \+ '\/passages\.json'[\s\S]*?indexes\/works\/' \+ sampleWorkId[\s\S]*?concept\.evidence/,
  'browser harness verifies the resumable local processing outputs',
);
assert.match(
  harness,
  /library-filter[\s\S]*?data-semantic-result[\s\S]*?Search result/,
  'browser harness verifies library search navigates to the source reader',
);
assert.match(
  harness,
  /reader-mode-btn[\s\S]*?native-passage\[data-passage-id\][\s\S]*?native-source-link[\s\S]*?Authored source/,
  'browser harness verifies Native mode and its faithful-source return route',
);
assert.match(
  harness,
  /quiet test book[\s\S]*?highlight-dialog[\s\S]*?Portable highlight[\s\S]*?portable highlight restoration/,
  'browser harness verifies portable native highlights restore after reopening',
);
assert.match(
  harness,
  /annotations-browser-btn[\s\S]*?library-wide annotation browser[\s\S]*?quiet test/,
  'browser harness verifies local library-wide annotation search',
);
assert.match(
  harness,
  /library-tools-btn[\s\S]*?library validation report[\s\S]*?portable library export[\s\S]*?portable import confirmation after preflight[\s\S]*?conflict-safe portable library import/,
  'browser harness verifies validation plus original-file export and safe import',
);
assert.match(
  harness,
  /originalAnchorClick[\s\S]*?capturedExport[\s\S]*?\.books-library\.json[\s\S]*?capturedExport\.blob\.text\(\)[\s\S]*?Portable export interception/,
  'browser harness validates portable exports in memory without downloading them',
);
assert.match(
  html,
  /processing-queue-summary[\s\S]*?Build processing report[\s\S]*?Retry failed stages[\s\S]*?buildLibraryReport[\s\S]*?refreshProcessingQueueSummary[\s\S]*?buildActiveLibraryProcessingReport[\s\S]*?manual-retry/,
  'processing surfaces expose blocked jobs and safe per-work retry',
);
assert.match(
  html,
  /browserLocalAi\.pending\?\.size[\s\S]*?navigator\.connection\?\.saveData[\s\S]*?navigator\.getBattery[\s\S]*?battery\.level < 0\.15/,
  'background processing yields to interactive AI, Data Saver, and low battery',
);
assert.match(
  html,
  /counts\.collisions[\s\S]*?Folder needs review[\s\S]*?path collision/,
  'folder path collisions are visible instead of silently merged',
);
assert.match(
  harness,
  /Move this book to Trash[\s\S]*?recoverable trash record[\s\S]*?recoverable Trash restore action[\s\S]*?Trash restores original bytes and portable identity/,
  'browser harness verifies reversible removal through Trash',
);
assert.match(
  harness,
  /library-ask-btn[\s\S]*?source-grounded cited answer[\s\S]*?UNTRUSTED_SOURCE_EXCERPTS_JSON[\s\S]*?AI provenance run record[\s\S]*?AI citation faithful-source navigation/,
  'browser harness verifies cited host-mediated Ask and faithful source navigation',
);
assert.match(
  harness,
  /work-details-dialog[\s\S]*?Sample Field Notes[\s\S]*?portable work metadata write/,
  'browser harness verifies user-owned work metadata editing',
);
assert.match(
  harness,
  /work-enrich-btn[\s\S]*?source-grounded model semantic records[\s\S]*?extractConcepts[\s\S]*?modelSemantics/,
  'browser harness verifies evidence-bound host-mediated semantic enrichment',
);
assert.match(
  harness,
  /capturedSemanticChat[\s\S]*?UNTRUSTED_PASSAGES_JSON/,
  'semantic enrichment harness checks the untrusted-source prompt boundary',
);
assert.match(
  harness,
  /user-confirmed format grouping suggestion[\s\S]*?Group these formats[\s\S]*?work-centered grouped catalog[\s\S]*?recordState !==? 'merged'|user-confirmed format grouping suggestion[\s\S]*?recordState !==? 'merged'/,
  'browser harness verifies explicit work grouping and redirect records',
);
assert.match(
  harness,
  /work-split-btn[\s\S]*?Split these formats[\s\S]*?reversible work split[\s\S]*?format-grounded reading data/,
  'browser harness verifies the grouped-work split round trip',
);
assert.match(
  harness,
  /native-reader\[role="document"\]\[tabindex="0"\][\s\S]*?native-fallback-notice[\s\S]*?Grounded quiet reading[\s\S]*?reader-font-family[\s\S]*?native preference application/,
  'browser harness verifies accessible Native semantics and typography controls',
);
assert.match(
  harness,
  /portable concept rename write[\s\S]*?portable concept hide write[\s\S]*?portable concept merge write[\s\S]*?portable concept split restore/,
  'browser harness verifies portable concept rename, hide, merge, and split',
);
assert.match(
  harness,
  /deterministic tag facet[\s\S]*?portable saved-view write[\s\S]*?deterministic annotated smart view[\s\S]*?smart-view reset to all works/,
  'browser harness verifies portable views and deterministic library facets',
);
assert.match(
  harness,
  /number <= 58[\s\S]*?60-work library render[\s\S]*?deterministic 60-work tag facet[\s\S]*?filename-independent 60-work title search[\s\S]*?1 of 60/,
  'browser harness verifies the large-library organization exit gate',
);
assert.match(
  harness,
  /local storage accounting by data class[\s\S]*?background semantic processing pause[\s\S]*?derived cleanup preserves originals and portable records[\s\S]*?resumable local rebuild/,
  'browser harness verifies safe derived-data lifecycle controls',
);
assert.match(
  html,
  /reader-echo-sidecar[\s\S]*?Open related passage[\s\S]*?data-echo-feedback="wrong"[\s\S]*?reader-echo-mode[\s\S]*?Indicators \+ asides/,
  'Native Echoes expose explicit modes, grounded cards, navigation, and durable feedback',
);
assert.match(
  html,
  /data-paragraph-id[\s\S]*?native-echo-indicator[\s\S]*?data-echo-summary[\s\S]*?activeReaderPrefs\.echoMode === 'off'/,
  'Echo indicators remain paragraph-anchored, generated-text distinct, and immediately switchable off',
);
assert.match(
  html,
  /openActiveEchoTarget[\s\S]*?activeEchoReturnRoute[\s\S]*?returnFromEchoRoute[\s\S]*?paragraphId:route\.paragraphId/,
  'Echo passage navigation retains an exact Native paragraph return route',
);
assert.match(
  html,
  /readerEchoSidecar\.contains\(t\)[\s\S]*?PageDown[\s\S]*?queueReaderNavigation/,
  'reader navigation remains available while the Echo sidecar has focus',
);
assert.match(
  html,
  /const DEFAULT_READER_PREFS = Object\.freeze\(\{[\s\S]*?echoMode:\s*'off'/,
  'Echoes remains off by default until the real-library quality gate passes',
);
assert.match(
  harness,
  /echoMode\.value = 'indicators'[\s\S]*?grounded spoiler-aware Echo card[\s\S]*?Echo exact related-passage route[\s\S]*?Echo return route to original paragraph/,
  'hosted regression opts in through the real control and covers the Echo round trip',
);

console.log('Books persistent storage and library contract: PASS');
