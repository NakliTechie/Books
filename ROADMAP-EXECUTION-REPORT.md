# Books roadmap execution report

> **Run:** 2026-07-30
>
> **State:** Autonomous work and live mode validation complete; real Folder,
> OCR runtime, and account-specific release inspection remain.

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
  Google Books remains separate optional BYOK.

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

The last full autonomous validation passed all application contracts, built
238 static assets, and completed Wrangler's deployment dry-run. In Chrome, the
production standalone library loaded 40 works, opened a real EPUB in Faithful
mode, reflowed it into 352 Native source references, and produced no console
error. The candidate NakliOS regression also passed without a console error or
user-visible export download.

## Deferred to the final access window

1. Sign in to the Cloudflare dashboard's `naklitechie.com` account and enable
   local-file access for the Chrome extension when the disposable localhost
   import smoke is repeated.
2. Capture the production 40-book processing report and real labeled
   semantic queries.
3. Grant representative local and sync-managed/network folders for mutation,
   permission-loss, partial-write, and long-running reading/processing soaks.
4. Run the official PaddleOCR.js corpus benchmark in the actual browser
   worker.
5. Observe the Cloudflare Workers Git build and smoke the resulting
   `https://books.naklitechie.com/` release.

Product decisions remain separately consolidated in
`DEFERRED-DECISIONS.md`; none blocks faithful reading, lexical search, or the
existing release.
