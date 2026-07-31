# Lorewell

> **Lifecycle:** `living` — private semantic-library foundation.

Lorewell is a private semantic library and browser-native reader for ePub,
PDF, MOBI, AZW3, FB2, TXT, Markdown, and HTML. It works standalone at
`https://lorewell.naklitechie.com/` and as the stable `books` app inside
NakliOS. The former `https://books.naklitechie.com/` address permanently
redirects to the canonical Lorewell URL.

Standalone Lorewell offers both a permission-free Browser library in
origin-scoped IndexedDB and an optional Folder library that reads a recursive
collection in place. Folder metadata lives beside the books in `.books/`, so
browser-site-data loss does not erase its reading history. Inside NakliOS,
records live under `apps/books/` in the selected Folder or encrypted Crate.
Browser, Folder, and Crate remain separate libraries; switching never copies
or deletes data.

## Semantic-library direction

The modern take is not “Calibre in a browser.” It is a **private semantic
library**: the user owns the files, but the library actively helps them
understand, read, connect, and remember what is inside.

This direction is now active. The product and architecture live in
[SEMANTIC-LIBRARY-SPEC.md](SEMANTIC-LIBRARY-SPEC.md), accepted foundation
choices in
[SEMANTIC-LIBRARY-DECISIONS.md](SEMANTIC-LIBRARY-DECISIONS.md), and the gated
execution sequence and complete pending-item map in
[SEMANTIC-LIBRARY-WORKPLAN.md](SEMANTIC-LIBRARY-WORKPLAN.md). The
dependency-aware sequence for the work that remains is in
[BATCHED-ROADMAP.md](BATCHED-ROADMAP.md). Discreet, source-grounded concept,
scene, plot, and cross-genre connections while reading are defined in
[ECHOES-VISION.md](ECHOES-VISION.md) and delivered through
[ECHOES-WORKPLAN.md](ECHOES-WORKPLAN.md).

The approved name, Living Book mark, palette, asset usage, and compatibility
rules are recorded in [BRAND.md](BRAND.md).

The foundation now includes work/edition/asset identity, resumable local
passage indexing and concepts, Lorewell native reading, portable highlights,
library-wide annotation memory, library validation, catalog rebuild, and
conflict-safe portable export/import. Book removal now uses recoverable Trash;
permanent deletion is a separate confirmed action. Source-grounded Ask works
through NakliOS AI, on-device Gemma 4 E2B/E4B or CPU/WebAssembly sidecars, or
a visible OpenAI-compatible local/BYOK endpoint, with passage citations and
durable model-run provenance. Users can explicitly group
multiple source formats as one work and split them again without changing the
originals or losing format-grounded annotations. Native mode now exposes
stable references, time remaining, accessible landmarks, deeper typography,
source-grounded concepts, and explicit Faithful-only structure notices.
The work-centered library includes deterministic reading-state, rating, shelf,
tag, and annotation views. Queries, facets, and sort order can be saved as a
portable view inside the active Browser, Folder, or Crate library. Generated
concepts remain inspectable and can be renamed, hidden, merged, or split
through portable work-manifest overrides that survive derived-data rebuilds.

## v2.0 highlights — library intelligence

- Open an existing directory as a standalone library. Lorewell recursively finds
  supported formats, opens known books from its cached inventory immediately,
  and reconciles additions, changes, moves, renames, and missing files in the
  background.
- Canonical work metadata, reading state, annotations, shelves, saved views,
  and curation live in a documented `.books/` sidecar. The browser remembers
  the directory handle only as a reconnect convenience.
- Browser and native executors share durable per-work jobs with stage status,
  checkpoints, cancellation, retry, and expiring leases. Reading remains
  available if parsing, OCR, embeddings, or an AI provider is unavailable.
- An explicitly enabled 23 MB MiniLM encoder creates local semantic vectors;
  compact Float32 shards avoid JSON-vector bloat. Optional Gemma, NakliOS AI,
  Ollama, LM Studio, or remote BYOK enrichment produces source-grounded ideas
  with provider and model provenance.
- Lorewell matches ideas across works with bounded nearest-neighbour candidates,
  typed relationships, confidence, and passage evidence. Hybrid library search
  combines lexical passages and semantic ideas, and book details expose
  evidence-linked connections into other books.
- Book details can perform an explicit, single-work Open Library lookup by
  ISBN or visible title/author. Results never run across the collection,
  preserve user/source metadata, retain portable provenance and courtesy
  links, and cache a bounded cover only after a separate user action.
- `scripts/books-index.py` is the native collection indexer for larger
  libraries. It performs recursive incremental scans, preserves identity
  through strong-fingerprint renames, and writes the same portable artifacts
  the browser consumes.
- The 10,000-book inventory and 3,000-idea scale contracts run in the regular
  test suite. Resource-aware browser processing yields to reading and
  interactive AI, pauses on critically low battery, and respects Data Saver
  before downloading the semantic model.
- The checked-in native benchmark is reproducible with
  `npm run benchmark:indexer -- 1000`; the release-development machine measured
  2.22 seconds cold and 0.50 seconds warm for 1,000 small Markdown books.

The folder layout and executor contract are documented in
[FOLDER-LIBRARY-FORMAT.md](FOLDER-LIBRARY-FORMAT.md), with the completed
implementation plan in
[LIBRARY-INTELLIGENCE-WORKPLAN.md](LIBRARY-INTELLIGENCE-WORKPLAN.md).

## Echoes release-candidate highlights

- Stable paragraph anchors let browser and native indexing identify the same
  evidence after rebuilds without relying on rendered DOM order.
- Typed semantic units preserve the difference between claims, mechanisms,
  scenes, choices, conflicts, motifs, and outcomes before bounded cross-work
  matching.
- Native mode can show a quiet `◌` at a paragraph with an eligible connection.
  Its grounded card explains the relation, shows evidence from both books,
  conceals spoilers, opens the exact related paragraph, and keeps a route back.
- Echoes starts Off pending real-library quality calibration; readers can opt
  into indicator-only or optional-aside modes. Generated prose never becomes
  authored paragraph text, and speech runs only when the reader asks for it.
- Hide, wrong, unhelpful, spoiler, and work-exclusion feedback is durable user
  metadata; the graph, vectors, and reader indexes remain removable and
  rebuildable.
- The synthetic quality corpus, browser/native identity fixtures, 3,000-idea
  scale contract, security boundary, and live NakliOS reader round trip pass.
  Broad default rollout still awaits human usefulness labels on a real
  collection.

## v1.4 highlights

- Full standalone library with persistent books, positions, bookmarks, notes,
  covers, preferences, filtering, search, removal, and orphan recovery.
- Browser storage uses the same virtual `library/`, `notes/`, and `covers/`
  paths as NakliOS storage, keeping one application path across environments.
- Static Cloudflare Worker deployment at `lorewell.naklitechie.com`, with the
  previous `books.naklitechie.com` hostname retained as a permanent redirect and GitHub
  Workers Builds deploying every update pushed to `main`.
- Optional AI works through NakliOS's host-mediated broker, a built-in
  Transformers.js 4.2 WebGPU worker running Gemma 4 E2B or E4B, a small
  wllama CPU/WebAssembly fallback, or a visible OpenAI-compatible local/BYOK
  endpoint. The reader companion is a persistent sidecar, not a blocking
  dialog. Remote book-content requests require destination-specific consent;
  provider keys remain session-only.

## v1.1 highlights

- Explicit Folder/Crate picker with host confirmation and backend isolation.
- Library filter and sort by recently read, title, or author.
- A Continue Reading rail reopens the five most recently read books at their saved positions.
- Sidecars whose book file is missing stay visible and can only be recovered with the exact original filename; notes and positions are never silently rebound or deleted.
- Recoverable removal through an in-app Trash; duplicate filenames are refused
  instead of overwritten, and permanent deletion requires a separate confirmation.
- Reader appearance controls for font size, line height, text width, and color profile.
- Appearance defaults persist locally; hosted books can store a per-book override in their sidecar.
- PDF pages retain their authored layout.

## v1.2 highlights

- Library rows and Continue Reading show cached cover thumbnails. Foliate
  formats use the package cover, PDFs use page one, and unreadable/missing
  covers retain a typographic fallback without blocking the book.
- Cover files stay inside the active Lorewell Folder or Crate namespace and are
  never reused across a storage switch.
- Find-in-book (`Cmd/Ctrl+F`) searches EPUB/MOBI/AZW3/FB2 through Foliate's
  CFI-aware engine, PDF text page by page, and TXT/Markdown/HTML through the
  text adapter. Results cycle through one common accessible search bar.

## AI reading companion

- The reader sidecar can explain, summarize, extract key points, or answer a
  question about the current selection, PDF page, or text passage.
- Standalone and hosted Lorewell can run Gemma 4 E2B or E4B on-device in a
  dedicated WebGPU worker. E2B is the recommended smaller download at about
  3.4 GB; E4B is the higher-quality option at about 5.2 GB. A model downloads
  only after the user chooses Load and is cached by the browser.
- Firefox is detected before download. Because ONNX Runtime does not support
  its WebGPU execution provider there, Lorewell selects LFM2.5 230M Q5_K_M
  (about 170 MB) through wllama on single-thread CPU/WebAssembly. It is slower
  and less capable than Gemma, but runs entirely in the tab without WebGPU.
- Chromium runs an adapter and `shader-f16` capability preflight before Gemma
  starts. Load failures are translated into actionable memory, download/cache,
  or GPU diagnostics. “Clear model cache” removes only requests belonging to
  the selected model; library files and indexes are untouched.
- NakliOS AI remains the preferred hosted route. A visible OpenAI-compatible
  local or remote BYOK endpoint remains available as a fallback. Presets cover
  Ollama and LM Studio, and Test connection discovers their installed model
  identifiers before the provider is saved.
- Responses stream into a cancellable sidecar and cannot alter the book or its
  notes. Reading and lexical search remain fully usable without AI.

## How this fits in the repo

```
naklios-universe/
├── naklOS/                       ← the launcher (registry, sdk, mirror tree)
│   ├── sdk/naklios.js            ← SDK Lorewell vendors inline
│   └── index.html                ← Lorewell registry entry + storage host
└── Books/                        ← THIS INITIATIVE
    ├── SPEC.md                   ← shipped v1.4 architectural decisions
    ├── SEMANTIC-LIBRARY-SPEC.md  ← active product and architecture contract
    ├── SEMANTIC-LIBRARY-WORKPLAN.md ← phase status and remaining decision gates
    ├── BATCHED-ROADMAP.md        ← dependency-aware post-2.0 execution batches
    ├── ROADMAP-EXECUTION-REPORT.md ← delivered evidence and final access queue
    ├── LIBRARY-INTELLIGENCE-WORKPLAN.md ← completed v2 ingestion/ideas plan
    ├── ECHOES-VISION.md           ← cross-book and cross-genre reader vision
    ├── ECHOES-WORKPLAN.md         ← paragraph-level connection execution plan
    ├── FOLDER-LIBRARY-FORMAT.md ← durable `.books/` sidecar and executor contract
    ├── OCR-DECISION.md          ← accepted local-first OCR routes and artifact gate
    ├── BENCHMARKS.md            ← reproducible Folder and semantic quality evidence
    ├── SEMANTIC-QUALITY-GATE.md ← named quality defaults and recalibration rules
    ├── LIBRARY-MOVEMENT-CONTRACT.md ← proposed recoverable cross-backend transfer
    ├── DEFERRED-DECISIONS.md    ← consolidated end-of-roadmap user decisions
    ├── METADATA-PROVIDER-DECISION.md ← opt-in provider evidence and policy gate
    ├── PORTABLE-LIBRARY-FORMAT.md ← documented backup/import bundle
    ├── SYNC-CONTRACT.md          ← future private-continuity conflict rules
    ├── STORAGE-RECOVERY.md       ← quotas, data classes, and recovery order
    ├── AI-PROVIDER-PRIVACY.md    ← provider, consent, and provenance boundary
    ├── NATIVE-READER.md          ← reflow, fidelity, accessibility, and cleanup contract
    ├── SECURITY-REVIEW.md        ← current threat-boundary and release review
    ├── CALIBRE-RESEARCH.md       ← comparison input, not a parity mandate
    ├── walkthroughs.md           ← open scope-defining questions
    ├── DEFERRED.md               ← v2+ items with revisit triggers
    └── README.md                 ← this file (quickstart + status)
```

## Status

**Decisions locked:**
- [x] Slug + ID = `books`; folder = `naklios-universe/Books/`; branch = `main`
- [x] A0–A3: mount point, single-file ethos, data-path convention, SDK contract
- [x] A4 (revised) — Standalone = persistent browser-local library
- [x] A5 (Q2) — Book identity = slugified filename
- [x] A6 (Q3) — Library = scan-on-load
- [x] A7 (Q4) — Position schema = engine-discriminated
- [x] A8 (Q5) — Add books = sideload only
- [x] A9 (Q6) — Notes = bookmarks + per-book note
- [x] A10 (Q7) — Reader engine = hybrid (foliate-js + pdf.js)
- [x] A11 (Q8) — v1 formats = EPUB, PDF, MOBI, AZW3, FB2, TXT, MD, HTML

**Build status:**
- [x] Initiative scaffolded
- [x] Walkthroughs locked (2026-05-18)
- [x] Phase 1 — Foundation (shell, SDK, capability branch, empty state)
- [x] Phase 2 — Engine adapter + 3 readers (foliate-js + pdf.js + TextEngine, vendored)
- [x] Phase 3 — Persistence + reopen-flow (sidecar JSON, debounced writes)
- [x] Phase 4 — Bookmarks + per-book note (sidebar UI)
- [x] Launcher hand-off — NakliOS points at `lorewell.naklitechie.com`
- [x] Stage 6 — Security sweep
- [x] Stage 7 — Frontend walkthrough documented
- [x] v1.1 — Folder/Crate switching, library management, and reader preferences
- [x] v1.2 — cached covers and cross-engine in-book search
- [x] v1.3 — selection/page-scoped NakliOS AI reading companion
- [x] v1.4 — persistent standalone library + Cloudflare Workers deployment
- [x] Semantic foundation — work identity, local passages/search/concepts,
      Native reader, portable highlights, validation, backup/import, and
      recoverable Trash
- [x] Grounded AI boundary — cited library Ask, standalone local/BYOK,
      host-mediated NakliOS AI, and evidence-linked provenance
- [x] Native reader accessibility foundation — source fallbacks, references,
      concepts, reduced motion, typography, storage map, and derived cleanup
- [x] Work-centered organization — deterministic smart views, shelf/tag
      facets, ratings, and portable saved searches
- [x] v2.0 Folder libraries — recursive in-place sources, durable `.books/`
      records, incremental generations, permission recovery, and hash-based
      rename identity
- [x] v2.0 Library intelligence — shared browser/native queue, compact local
      vectors, source-grounded ideas, typed cross-book relations, and hybrid
      search
- [x] v2.0 Native indexer — local CPU/GPU or OpenAI-compatible/Ollama
      processing without stored credentials
- [x] Echoes release candidate — paragraph anchors, typed fiction/nonfiction
      units, graph v2, materialized reader connections, Native indicators and
      cards, spoiler controls, speech, curation, and exact cross-book routes
- [x] Scale contracts — 10,000-book inventory and 3,000-idea bounded graph
- [x] Contract test at `scripts/test-books-v1_1.mjs`
- [x] Safe two-backend browser fixture at `test/host-harness.html`

See [SPEC.md §"Build sequence"](SPEC.md) for the ordered steps.

## Related docs

- [SPEC.md](SPEC.md)
- [walkthroughs.md](walkthroughs.md)
- [DEFERRED.md](DEFERRED.md)
- [BATCHED-ROADMAP.md](BATCHED-ROADMAP.md) — dependency-aware execution plan
  for the work remaining after Lorewell 2.0
- [ROADMAP-EXECUTION-REPORT.md](ROADMAP-EXECUTION-REPORT.md) — delivered
  autonomous roadmap evidence and the final access-dependent release queue
- [CALIBRE-RESEARCH.md](CALIBRE-RESEARCH.md) — official feature inventory and
  comparison worksheet
- [SEMANTIC-LIBRARY-SPEC.md](SEMANTIC-LIBRARY-SPEC.md) — active private
  semantic-library contract and decision ledger
- [SEMANTIC-LIBRARY-WORKPLAN.md](SEMANTIC-LIBRARY-WORKPLAN.md) — completed
  foundation phases and remaining explicit decision gates
- [PORTABLE-LIBRARY-FORMAT.md](PORTABLE-LIBRARY-FORMAT.md) — versioned,
  conflict-safe original-file and portable-record bundle
- [FOLDER-LIBRARY-FORMAT.md](FOLDER-LIBRARY-FORMAT.md) — recursive folder
  inventory, `.books/` sidecar, shared jobs, and derived artifact schemas
- [OCR-DECISION.md](OCR-DECISION.md) — PaddleOCR browser/local-service
  decision, versioned OCR artifact, and corpus gate
- [BENCHMARKS.md](BENCHMARKS.md) — 1k/10k Folder mutation timings and labeled
  MiniLM/lexical/hybrid retrieval evidence
- [SEMANTIC-QUALITY-GATE.md](SEMANTIC-QUALITY-GATE.md) — named browser/native
  quality defaults, thresholds, evidence requirements, and recalibration gate
- [ECHOES-VISION.md](ECHOES-VISION.md) — source-grounded concept, scene,
  plot, and cross-genre connections at the point of reading
- [ECHOES-WORKPLAN.md](ECHOES-WORKPLAN.md) — paragraph anchors, typed semantic
  units, graph v2, Native-reader indicators, quality gates, and rollout
- [LIBRARY-MOVEMENT-CONTRACT.md](LIBRARY-MOVEMENT-CONTRACT.md) — proposed
  two-phase Copy/Move, rollback, and multiple-root ownership semantics
- [DEFERRED-DECISIONS.md](DEFERRED-DECISIONS.md) — access checks and product
  choices deliberately deferred until autonomous roadmap work is complete
- [METADATA-PROVIDER-DECISION.md](METADATA-PROVIDER-DECISION.md) — Open
  Library recommendation, Google Books disposition, and approval gate
- [AI-PROVIDER-PRIVACY.md](AI-PROVIDER-PRIVACY.md) — exact standalone and
  NakliOS model boundary, consent, credential, and provenance rules
- [NATIVE-READER.md](NATIVE-READER.md) — Native/Faithful fidelity,
  accessibility, preferences, and derived-data lifecycle
- [SYNC-CONTRACT.md](SYNC-CONTRACT.md) — version ancestry, tombstones, and
  deterministic record-level conflict behavior for any future transport
- [STORAGE-RECOVERY.md](STORAGE-RECOVERY.md) — backend isolation, browser
  quota guidance, and recovery order
- [SECURITY-REVIEW.md](SECURITY-REVIEW.md) — application, provider, portable
  data, and Cloudflare release boundaries

## Context

- NakliOS launcher: `../naklOS/` — `id:'books'` already in the APPS registry at v2.18
- SDK reference: `../naklOS/sdk/naklios.js` — vendor inline; use
  `naklios.fs.{read,readBinary,write,list}` for persistence and
  `naklios.ai.chat.completions.create` for optional hosted inference
- Storage-switch precedent: Tijori (`../Tijori/`)

## Development and deployment

```sh
npm install
npm test
npm run test:browser # real Chrome: hosted semantic journey + 60-work journey
npm run dev
npm run report -- /path/to/library
npm run benchmark:indexer -- 1000
```

Index a folder natively without changing its source files:

```sh
npm run index -- /path/to/library --no-embeddings

# SentenceTransformers on local CPU/GPU
npm run index -- /path/to/library

# Ollama or another OpenAI-compatible local endpoint
npm run index -- /path/to/library \
  --endpoint http://127.0.0.1:11434 \
  --embedding-model nomic-embed-text \
  --chat-model gemma3:4b
```

Install `sentence-transformers` for in-process embeddings and `pypdf` for
native PDF text extraction. MOBI/AZW3 native parsing uses Calibre's
`ebook-convert` when installed. Credentials are accepted only through
`--api-key` or `BOOKS_AI_API_KEY` and are never written into `.books/`.

`wrangler.jsonc` deploys the checked-in app and vendored readers as Worker
static assets. Cloudflare Workers Builds watches the GitHub `main` branch; a
push is the production release path. `npm run deploy` remains available for a
manual recovery deployment.

## Branch

Current development happens on `main`. To get started:

```
cd /Users/chiragpatnaik/Code/naklios-universe/Books
git checkout main
```
