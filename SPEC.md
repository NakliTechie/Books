# books — Spec

> **Lifecycle:** `draft` — design only, no implementation yet. Individual sections will be locked as walkthroughs close; the whole doc flips to `locked` once every walkthrough question is closed.

## Goal

A single-file, browser-native reader for ePub and PDF, slotted into nakliOS as the `books` app. The user's books live in their connected nakliOS folder at `apps/books/library/*.{epub,pdf}`; reading position and notes persist as sidecar JSON at `apps/books/notes/<book-id>.json`. Because the data is just files in the user's folder, the library is portable across devices and survives the launcher itself.

Success v1: open a book from the library, read it to completion, close it, reopen it — position is exactly where it was. Works inside nakliOS (where folder access comes from the host via the SDK) and degrades gracefully when run standalone (decision TBD — walkthrough Q1).

## Architectural decisions

Locked decisions live here. Each is referenced by walkthrough number when applicable.

- **A0. App ID + mount point.** `id:'books'`, mounted at `naklios.dev/apps/books/` (same-origin mirror, FSA-required). Already reserved in naklOS v2.18; this initiative replaces the "Coming soon" stub with a working app.
- **A1. Single-file ethos.** Entire app is one `index.html` — markup, styles, logic inline. epub.js and pdf.js are loaded from CDN with SRI hashes (single binary dependency per format).
- **A2. Data path convention.** All persistence under `apps/books/` in the host folder, via the `naklios.fs.*` RPC. Subdirs: `library/` (the books themselves), `notes/` (per-book sidecar JSON). No `localStorage` or `IndexedDB` for canonical state.
- **A3. SDK contract.** Vendor `naklios.js` (sdk surface v1) inline. Call `naklios.ready()` after init, `naklios.title('Books — <book-title>')` on book open. Listen to `onCapabilitiesChange` for fs availability.

(More A-numbered decisions get appended as walkthroughs lock — A4 onwards.)

## Schema additions

### Sidecar JSON shape — `apps/books/notes/<book-id>.json`

Shape will be locked at walkthrough Q4. Draft target:

```json
{
  "bookId": "<stable identifier — see Q3>",
  "title": "...",
  "format": "epub" | "pdf",
  "position": {
    "epub": { "cfi": "epubcfi(/6/12!/4/2/2[chap03])" },
    "pdf":  { "page": 47, "scrollY": 0.32 }
  },
  "lastOpened": "2026-05-18T...Z",
  "notes": [ ... ]  // shape locked at Q6
}
```

### Library index — `apps/books/index.json` (TBD per Q3)

Either maintained or scan-on-load — locks at Q3.

## Endpoints / public surface

No HTTP endpoints. The app's only public surface is the iframe at `naklios.dev/apps/books/`, plus the canonical standalone URL (TBD per Q2).

## Build sequence

When implementation starts, the work breaks into phases:

**Phase 1 — Foundation**
1. Replace the stub `index.html` with a minimal app shell: theme tokens, SDK vendoring, capability detection, "no folder connected" empty state.
2. Wire `naklios.fs.list('library/')` → flat list of books in the library directory.

**Phase 2 — Reader (one format first; second format added in 2b)**
1. ePub reader: epub.js (or chosen lib per Q-libs) reading position via CFI, render into a viewport.
2. PDF reader: pdf.js, page-based navigation with scroll position capture.

**Phase 3 — Persistence + reopen-flow**
1. Read/write `apps/books/notes/<book-id>.json` for position on open + on close (debounce).
2. Library list shows "last read" indicator per book.
3. Decide library index (Q3) — implement scan-or-maintained accordingly.

**Phase 4 — Notes + polish**
1. Notes UX per Q6 (bookmark-only, free-text, or highlights).
2. Theme integration (`naklios.theme.onChange` → CSS var swap).
3. Standalone-mode behavior per Q1.

## What this spec deliberately leaves out

The canonical list with revisit triggers lives in [DEFERRED.md](DEFERRED.md).

- **Reader prefs panel** (font size, line height, margins, justification) — out of v1.
- **Cover thumbnails** — text-only library list in v1.
- **Cross-device sync conflict resolution** — assumed handled by file-system semantics or by future private-mesh integration.
- **Search across library** — out of v1.
- **Multiple libraries / shelves** — one flat library in v1.

## References

- [walkthroughs.md](walkthroughs.md) — open scope-defining questions
- [DEFERRED.md](DEFERRED.md) — items pushed to v2+
- [README.md](README.md) — quickstart + status
- naklOS SDK source: `/Users/chiragpatnaik/Code/naklios-universe/naklOS/sdk/naklios.js`
- Stub: `/Users/chiragpatnaik/Code/naklios-universe/naklOS/apps/books/index.html`
- Mirror manifest: `/Users/chiragpatnaik/Code/naklios-universe/naklOS/apps/manifest.json`
