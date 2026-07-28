# books

> **Lifecycle:** `living` — v1 shipped; v1.1 base-utilities upgrade implemented locally.

Books is a single-file, browser-native reader for ePub, PDF, MOBI, AZW3, FB2, TXT, Markdown, and HTML, slotted into NakliOS as the `books` app. Books and their sidecars live under `apps/books/` in the Folder or encrypted Crate selected for Books. Each backend remains a separate library; switching never copies or deletes data.

Standalone mode remains a one-book, in-memory preview. NakliOS always keeps Books hosted—even in Basic mode—so the app can use the scoped storage bridge.

## v1.1 highlights

- Explicit Folder/Crate picker with host confirmation and backend isolation.
- Library filter and sort by recently read, title, or author.
- A Continue Reading rail reopens the five most recently read books at their saved positions.
- Sidecars whose book file is missing stay visible and can only be recovered with the exact original filename; notes and positions are never silently rebound or deleted.
- Safe removal through an in-app modal; duplicate filenames are refused instead of overwritten.
- Reader appearance controls for font size, line height, text width, and color profile.
- Appearance defaults persist locally; hosted books can store a per-book override in their sidecar.
- PDF pages retain their authored layout.

## How this fits in the repo

```
naklios-universe/
├── naklOS/                       ← the launcher (registry, sdk, mirror tree)
│   ├── sdk/naklios.js            ← SDK Books vendors inline
│   └── index.html                ← Books registry entry + storage host
└── Books/                        ← THIS INITIATIVE
    ├── SPEC.md                   ← architectural decisions
    ├── walkthroughs.md           ← open scope-defining questions
    ├── DEFERRED.md               ← v2+ items with revisit triggers
    └── README.md                 ← this file (quickstart + status)
```

## Status

**Decisions locked:**
- [x] Slug + ID = `books`; folder = `naklios-universe/Books/`; branch = `main`
- [x] A0–A3: mount point, single-file ethos, data-path convention, SDK contract
- [x] A4 (Q1) — Standalone = preview-only
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
- [x] Launcher hand-off — NakliOS points at `naklitechie.github.io/Books/`
- [x] Stage 6 — Security sweep
- [x] Stage 7 — Frontend walkthrough documented
- [x] v1.1 — Folder/Crate switching, library management, and reader preferences
- [x] Contract test at `scripts/test-books-v1_1.mjs`
- [x] Safe two-backend browser fixture at `test/host-harness.html`

See [SPEC.md §"Build sequence"](SPEC.md) for the ordered steps.

## Related docs

- [SPEC.md](SPEC.md)
- [walkthroughs.md](walkthroughs.md)
- [DEFERRED.md](DEFERRED.md)

## Context

- NakliOS launcher: `../naklOS/` — `id:'books'` already in the APPS registry at v2.18
- SDK reference: `../naklOS/sdk/naklios.js` — vendor inline; use `naklios.fs.{read,readBinary,write,list}` for persistence
- Storage-switch precedent: Tijori (`../Tijori/`)

## Branch

Current development happens on `main`. To get started:

```
cd /Users/chiragpatnaik/Code/naklios-universe/Books
git checkout main
```
