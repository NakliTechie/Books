# books

> **Lifecycle:** `living` — SPEC.md locked 2026-05-18; implementation begins on `booksv1`.

Books is a single-file browser-native reader for ePub and PDF, slotted into nakliOS as the `books` app. Books live in the user's connected nakliOS folder (`apps/books/library/*.{epub,pdf}`) and reading position + notes persist back to that folder as sidecar JSON — so the library is portable across devices and outlives the launcher.

Replaces the "Coming soon" stub already registered in naklOS v2.18.

## How this fits in the repo

```
naklios-universe/
├── naklOS/                       ← the launcher (registry, sdk, mirror tree)
│   ├── sdk/naklios.js            ← SDK Books vendors inline
│   ├── apps/books/index.html     ← current stub; replaced by mirror sync once Books ships
│   └── apps/manifest.json        ← Books entry added during Phase 4
└── Books/                        ← THIS INITIATIVE
    ├── SPEC.md                   ← architectural decisions
    ├── walkthroughs.md           ← open scope-defining questions
    ├── DEFERRED.md               ← v2+ items with revisit triggers
    └── README.md                 ← this file (quickstart + status)
```

Eventually this folder will also hold `index.html` (the app itself) + `LICENSE` + `.gitignore`.

## Status

**Decisions locked:**
- [x] Slug + ID = `books`; folder = `naklios-universe/Books/`; branch = `booksv1`
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
- [ ] Launcher hand-off — update naklOS APPS entry to point at github.io/Books/ + delete the stub. **Blocked on user-side:** create NakliTechie/Books GitHub repo, push booksv1 → main, enable Pages.
- [ ] Stage 6 — Security sweep
- [ ] Stage 7 — Frontend walkthrough (verify each format renders end-to-end)

See [SPEC.md §"Build sequence"](SPEC.md) for the ordered steps.

## Related docs

- [SPEC.md](SPEC.md)
- [walkthroughs.md](walkthroughs.md)
- [DEFERRED.md](DEFERRED.md)

## Context

- naklOS launcher: `../naklOS/` — `id:'books'` already in the APPS registry at v2.18
- Current Books stub (mirror side): `../naklOS/apps/books/index.html` — gets replaced by `sync-mirrors.sh` once this repo has shipped content
- SDK reference: `../naklOS/sdk/naklios.js` — vendor inline; use `naklios.fs.{read,readBinary,write,list}` for persistence
- Mirror precedent: Tijori (`../Tijori/`) — same FSA-required category

## Branch

This initiative is being built on `booksv1`. To get started:

```
cd /Users/chiragpatnaik/Code/naklios-universe/Books
git checkout booksv1
```
