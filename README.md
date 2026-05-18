# books

> **Lifecycle:** `draft` — initiative scaffolded 2026-05-18. Will flip to `living` once SPEC.md locks.

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
- [x] A0–A3: mount point, single-file ethos, data-path convention, SDK contract (see [SPEC.md](SPEC.md))
- [ ] Q1 — Standalone behavior
- [ ] Q2 — Book identity
- [ ] Q3 — Library index
- [ ] Q4 — Reading-position schema *(shape depends on Q7)*
- [ ] Q5 — Adding books
- [ ] Q6 — Notes v1 scope
- [ ] Q7 — Reader engine *(upstream of Q4 and Q8)*
- [ ] Q8 — Format scope for v1

**Build status:**
- [x] Initiative scaffolded
- [ ] Walkthroughs locked
- [ ] Phase 1 — Foundation (shell, SDK wire-up, empty state)
- [ ] Phase 2 — Reader (ePub then PDF)
- [ ] Phase 3 — Persistence + reopen-flow
- [ ] Phase 4 — Notes + polish + stub-replacement

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
