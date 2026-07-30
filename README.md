# books

> **Lifecycle:** `living` — v1.4 persistent standalone library.

Books is a single-file, browser-native reader for ePub, PDF, MOBI, AZW3, FB2, TXT, Markdown, and HTML. It works as a standalone application at `https://books.naklitechie.com/` and as the `books` app inside NakliOS.

Standalone books and sidecars persist in origin-scoped IndexedDB on the current device. Inside NakliOS, they live under `apps/books/` in the selected Folder or encrypted Crate. Browser, Folder, and Crate remain separate libraries; switching never copies or deletes data.

## Proposed v2+ direction

The modern take is not “Calibre in a browser.” It is a **private semantic
library**: the user owns the files, but the library actively helps them
understand, read, connect, and remember what is inside.

This direction is now active. The product and architecture live in
[SEMANTIC-LIBRARY-SPEC.md](SEMANTIC-LIBRARY-SPEC.md), accepted foundation
choices in
[SEMANTIC-LIBRARY-DECISIONS.md](SEMANTIC-LIBRARY-DECISIONS.md), and the gated
execution sequence and complete pending-item map in
[SEMANTIC-LIBRARY-WORKPLAN.md](SEMANTIC-LIBRARY-WORKPLAN.md).

The foundation now includes work/edition/asset identity, resumable local
passage indexing and concepts, Books-native reading, portable highlights,
library-wide annotation memory, library validation, catalog rebuild, and
conflict-safe portable export/import. Book removal now uses recoverable Trash;
permanent deletion is a separate confirmed action. Source-grounded Ask works
through NakliOS AI or a visible OpenAI-compatible local/BYOK endpoint, with
passage citations and durable model-run provenance. Users can explicitly group
multiple source formats as one work and split them again without changing the
originals or losing format-grounded annotations. Native mode now exposes
stable references, time remaining, accessible landmarks, deeper typography,
source-grounded concepts, and explicit Faithful-only structure notices.

## v1.4 highlights

- Full standalone library with persistent books, positions, bookmarks, notes,
  covers, preferences, filtering, search, removal, and orphan recovery.
- Browser storage uses the same virtual `library/`, `notes/`, and `covers/`
  paths as NakliOS storage, keeping one application path across environments.
- Static Cloudflare Worker deployment at `books.naklitechie.com`, with GitHub
  Workers Builds deploying every update pushed to `main`.
- Optional AI works through NakliOS's host-mediated broker or a standalone,
  visible OpenAI-compatible local/BYOK endpoint. Remote book-content requests
  require destination-specific consent; provider keys remain session-only.

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
- Cover files stay inside the active Books Folder or Crate namespace and are
  never reused across a storage switch.
- Find-in-book (`Cmd/Ctrl+F`) searches EPUB/MOBI/AZW3/FB2 through Foliate's
  CFI-aware engine, PDF text page by page, and TXT/Markdown/HTML through the
  text adapter. Results cycle through one common accessible search bar.

## v1.3 highlights

- A hosted-only NakliOS AI reading companion can explain, summarize, extract key
  points, or answer a question about the current selection, PDF page, or text
  passage.
- Books uses the shared `naklios.ai` model service: it does not download or
  manage a second model and never receives another app's prompts.
- Responses stream into a cancellable, app-styled dialog and cannot alter the
  book or its notes. Standalone can use a local/BYOK provider, while reading
  and local lexical search remain fully usable without AI.

## How this fits in the repo

```
naklios-universe/
├── naklOS/                       ← the launcher (registry, sdk, mirror tree)
│   ├── sdk/naklios.js            ← SDK Books vendors inline
│   └── index.html                ← Books registry entry + storage host
└── Books/                        ← THIS INITIATIVE
    ├── SPEC.md                   ← shipped v1.4 architectural decisions
    ├── SEMANTIC-LIBRARY-SPEC.md  ← proposed v2+ product and architecture
    ├── SEMANTIC-LIBRARY-WORKPLAN.md ← pending phases and decision gates
    ├── PORTABLE-LIBRARY-FORMAT.md ← documented backup/import bundle
    ├── AI-PROVIDER-PRIVACY.md  ← provider, consent, and provenance boundary
    ├── NATIVE-READER.md        ← reflow, fidelity, accessibility, and cleanup contract
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
- [x] Launcher hand-off — NakliOS points at `books.naklitechie.com`
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
- [x] Contract test at `scripts/test-books-v1_1.mjs`
- [x] Safe two-backend browser fixture at `test/host-harness.html`

See [SPEC.md §"Build sequence"](SPEC.md) for the ordered steps.

## Related docs

- [SPEC.md](SPEC.md)
- [walkthroughs.md](walkthroughs.md)
- [DEFERRED.md](DEFERRED.md)
- [CALIBRE-RESEARCH.md](CALIBRE-RESEARCH.md) — official feature inventory and
  comparison worksheet
- [SEMANTIC-LIBRARY-SPEC.md](SEMANTIC-LIBRARY-SPEC.md) — proposed private
  semantic library extension
- [SEMANTIC-LIBRARY-WORKPLAN.md](SEMANTIC-LIBRARY-WORKPLAN.md) — phased,
  gated plan containing all pending work
- [PORTABLE-LIBRARY-FORMAT.md](PORTABLE-LIBRARY-FORMAT.md) — versioned,
  conflict-safe original-file and portable-record bundle
- [AI-PROVIDER-PRIVACY.md](AI-PROVIDER-PRIVACY.md) — exact standalone and
  NakliOS model boundary, consent, credential, and provenance rules
- [NATIVE-READER.md](NATIVE-READER.md) — Native/Faithful fidelity,
  accessibility, preferences, and derived-data lifecycle

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
npm run dev
```

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
