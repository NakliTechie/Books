# Lorewell roadmap execution report

> **Run:** 2026-08-01
>
> **State:** Production stabilization deployed. Unit/native contracts, direct
> standalone Chrome, NakliOS host Chrome, the production Worker, and a real
> production EPUB all pass. The sync-folder soak, human semantic labels,
> bounded very-large-library indexing, and gated OCR runtime remain.

## 2026-08-01 production stabilization

- Replaced Cloudflare-redirected `vendor/*@version/` dynamic imports with
  build-time, redirect-free Foliate and PDF.js aliases. The production
  Foliate entry module now returns JavaScript with `200` and zero redirects.
- Made book switches transactional: a failing parser cannot leave a phantom
  active book or prevent Retry, and the old reader is never mistaken for the
  newly selected source.
- Made authored HTML inert but faithful, virtualized PDF page rendering, and
  hardened EPUB/FB2/native extraction against archive bombs, duplicate text,
  source races, unsafe manifests, symlinks, and partial inventory scans.
- Versioned stable paragraph anchors, made Unicode splitting surrogate-safe,
  filtered ebook boilerplate, hardened embedding caches, and aligned native
  and browser graph/link identities.
- Corrected Echo directionality, evidence gating, spoiler concealment,
  canonical curation, and portable curation import/export.
- Added cancellable local-model loading with terminal worker acknowledgement,
  watchdogs, truthful per-file progress, and quiet user-cancel behavior.
- Tightened NakliOS parent-origin verification and the native reporting
  command's sidecar confinement.
- Added a direct standalone browser release journey covering persistence,
  reading, AI-sidecar page navigation, and reopen. Existing hosted and 60-work
  journeys remain release gates.
- Deployed Cloudflare Worker version
  `a4cc638a-5f32-44ec-a658-9a3d6bc4adc1`. `books.naklitechie.com` continues
  to redirect permanently to `lorewell.naklitechie.com`.

## 2026-08-01 connection calibration engineering

- Added a deterministic, rebuildable review queue stratified across three
  genre directions, likely false positives, generic/repetitive concepts, and
  spoiler-sensitive targets, plus balanced library-query checks.
- Added portable `books.echo-evaluations` judgments with evidence hashes,
  compact provenance, resumable progress, conflict-safe import/export, and a
  hard no-source-text boundary.
- Added a first-class Ideas & connections explorer, side-by-side evidence
  review, search checks, privacy-safe quality reports, and exact source/return
  navigation shared with Native-reader Echoes.
- Added in-app and native CLI quality reporting with label, direction,
  relation, generation-route, score-bin, evidence, and search-relevance
  summaries. Threshold suggestions are advisory and cannot change rollout
  without human approval.
- Extended standalone and NakliOS Chrome journeys plus the visual guide to
  cover the complete explorer/review/report flow. Real-library usefulness
  labels and the default-rollout choice remain deliberately human.

## Delivered in this run

### Release hygiene and operations

- The host regression intercepts portable library exports in memory, validates
  their originals and records, and no longer writes
  `books-library*.json` fixtures into Downloads.
- Downloads currently contains zero matching fixture exports.
- Folder libraries have a portable CLI report plus an in-app queue summary
  with per-work outcomes, provider/model details, errors, cancel/resume, and
  retry from the earliest failed stage.
- Background processing has contract coverage for yielding to interactive AI,
  Data Saver, and critically low battery.
- A one-time welcome explains the fast single-book and durable Folder paths;
  Help now opens the shipped 17-screen visual guide from both Library and
  Reader.
- Reading starts with the Library pane collapsed. Its top-bar toggle is
  keyboard-accessible, remembers the reader's preference, and becomes an
  overlay on narrow screens instead of squeezing the page.
- The populated Library now prioritizes Continue Reading, one title/author/text
  search, and Add book; saved views and maintenance sit under Library options.

### Folder durability

- Case-folding and Unicode-normalization path collisions are detected and
  reported without merging sources.
- A source that changes during fingerprinting is quarantined as
  `waiting-for-stable-source`.
- A malformed/incomplete current inventory recovers from the newest completed
  generation.
- The native benchmark covers cold, warm, modify, move/rename, and missing
  reconciliation at 1,000 and 10,000 sources. Move retains work identity and
  missing files remain reviewable.
- Multiple-root ownership and recoverable Browser/Folder/Crate Copy/Move
  semantics are specified but remain disabled behind approval.
- A user-granted disposable recursive Folder completed add, repeated missing,
  and restored rename checks. Restoring a source after an intervening missing
  generation initially created a duplicate work. Reconciliation now carries
  missing inventory candidates forward and consumes the recovered row only
  after a strong-fingerprint match; browser and native regressions cover it.

### Semantic quality and parity

- A reproducible 12-topic MiniLM benchmark compares lexical, semantic, and
  hybrid retrieval. The recorded synthetic run passed at 100% semantic and
  hybrid recall@3/MRR; multilingual diagnostics remain explicitly non-gating.
- Passage, concept/evidence, scene, relationship, model-confidence, and hybrid
  weighting defaults are named and documented in
  `SEMANTIC-QUALITY-GATE.md`.
- Browser and native executors now agree on source/work identity, passages,
  normalized ranges, quote hashes, lexical postings, concepts, section
  scenes, ideas, evidence, relation behavior, and stable link IDs.
- Low-confidence model relation classifications cannot overwrite a
  deterministic relation.

### OCR and metadata decisions

- OCR adopts an Adapt/Adopt local-first split: official PaddleOCR.js for the
  compact browser route, visible local PaddleOCR/PP-StructureV3 for complex
  pages, and no hosted route without explicit destination consent.
- OCR artifacts have source fingerprints, page-pixel anchors, region kinds,
  confidence, model provenance, lifecycle states, and one removable path.
- Six self-authored CC0 fixtures and six pinned, checksum-verified
  public-domain/CC0 real fixtures cover synthetic degradation, formulas,
  tables, figures, multi-column reading order, handwriting, and a camera
  negative-control.
- Official PaddleOCR.js package and model byte budgets are recorded. The
  production OCR queue remains closed until browser quality/resource evidence
  passes.
- Open Library is recommended only for explicit on-demand ISBN lookup;
  library-wide automatic queries and fuzzy automatic overwrites are rejected.
  The approved implementation is now an explicit per-book action with five
  bounded candidates, provider courtesy links and provenance, preserved
  user/source metadata, and a separate capped cover download. Google Books
  remains out of the core provider list.

### Product-held batches

- Illustration generation remains closed behind purpose/style/provider,
  consent, safety/copyright, storage, and evidence-quality decisions.
- Sync retains the existing transport-independent version, ancestry,
  tombstone, and conflict contract; no network transport was silently chosen.
- Reader-depth candidates remain demand-ranked rather than bundled.
- CBZ/CBR, DjVu, conversion, polishing, news, stores, devices, plugins, and
  other Calibre-shaped capabilities remain separate approved bets.

## Reproducible evidence

```sh
npm test
npm run build
WRANGLER_LOG_PATH=/private/tmp/books-wrangler.log npx wrangler deploy --dry-run
npm run benchmark:indexer -- 1000
npm run benchmark:indexer -- 10000
npm run benchmark:semantic
npm run corpus:ocr -- /path/to/output
npm run corpus:ocr-public -- /path/to/output
npm run report -- /path/to/folder-library
```

The current release validation passed all application contracts, built and
validated 271 Worker assets, passed direct standalone, full NakliOS host, and
60-work Chrome journeys, and completed Wrangler's deployment dry-run and live
deployment. In the signed-in Chrome profile, the previously failing production
EPUB opened at its saved 5% position in Foliate with navigation and AI controls
available and no console error. The candidate NakliOS regression also passed
without a console error or user-visible export download.

GitHub `main` deployed through the existing Cloudflare Git integration. The
production in-app report records 40 available sources and 40 core-complete
jobs; 20,910 passages, 636 concepts, 457 scenes, 636 source-grounded ideas,
zero issues, and 1,677 cross-book relationships after Background Intelligence
was enabled and the local MiniLM encoder completed.

## Deferred after this release

1. Grant a representative sync-managed/network Folder for permission-loss,
   partial-write, conflict, and long-running reading/processing soaks.
2. Run the official PaddleOCR.js corpus benchmark in the actual browser worker
   before opening the production OCR queue.
3. Label production semantic queries and relationship judgments; enabling the
   model builds evidence but does not substitute for human quality labels.
4. Capture cold Gemma 4 E2B transfer, peak browser memory, and forced worker
   recovery across the supported browser/device matrix.

Product decisions remain separately consolidated in
`DEFERRED-DECISIONS.md`; none blocks faithful reading, lexical search, or the
existing release.
