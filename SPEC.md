# books — Spec

> **Lifecycle:** `living` — v1 decisions locked 2026-05-18; standalone architecture revised for v1.4 on 2026-07-30.
>
> This document remains the shipped v1.4 contract. The proposed v2+ private
> semantic library extension is specified separately in
> [SEMANTIC-LIBRARY-SPEC.md](SEMANTIC-LIBRARY-SPEC.md), with pending execution
> phases in [SEMANTIC-LIBRARY-WORKPLAN.md](SEMANTIC-LIBRARY-WORKPLAN.md).

## Goal

A single-file, browser-native reader for ePub, PDF, MOBI, AZW3, FB2, TXT, Markdown, and HTML — usable independently and slotted into NakliOS as the `books` app. In standalone mode, the library persists in origin-scoped IndexedDB. Inside NakliOS, books live in the selected Folder or encrypted Crate at `apps/books/library/*`; reading position + bookmarks + per-book notes persist as sidecar JSON at `apps/books/notes/<bookId>.json`.

Success v1.4: open any supported format from the library, read, close, and reopen with the position restored both at `books.naklitechie.com` and inside NakliOS.

Success v1.1: Books remains hosted in every NakliOS desktop mode; users can explicitly switch between connected Folder and Crate libraries, manage a larger flat library, and tune reading appearance. Switching backends never copies or deletes data.

## Architectural decisions

### A0. App ID + mount point
`id:'books'`, served from `https://books.naklitechie.com/` as Cloudflare Worker static assets. **Cross-origin to NakliOS**, not mirrored. Standalone storage is origin-scoped IndexedDB; hosted storage goes through `naklios.fs.*` postMessage RPC, which is cross-origin-safe. The NakliOS registry points production at the custom domain and uses the sibling local checkout only on localhost for browser validation.

### A1. Single-file-app + vendored libraries
The app code itself is one `index.html` — markup, styles, logic inline. Third-party libraries (`foliate-js`, `pdfjs-dist`) are **vendored** under `Books/vendor/<lib>@<version>/` and loaded via relative `<script>` paths. No runtime CDN dependency. See A10 for engine details. An internal `Engine` adapter interface insulates app code from library churn.

### A2. Data path convention
All persistence uses the same `naklios.fs.*` virtual paths. NakliOS scopes them under `apps/books/` in the selected backend; standalone mode stores them in an origin-scoped IndexedDB object store. Subdirs:
- `apps/books/library/` — the books themselves (one file per book)
- `apps/books/notes/<bookId>.json` — per-book sidecar (position, bookmarks, note)
- `apps/books/covers/` — cached cover thumbnails

`localStorage` is used only for UI preferences. Canonical standalone library state lives in IndexedDB; canonical hosted state remains in the selected Folder or Crate.

### A3. SDK contract
Vendor `naklios.js` inline (sdk surface v1). Call `naklios.ready()` after init; `naklios.title('Books — <book-title>')` on book open; subscribe to `naklios.onCapabilitiesChange` for fs availability and to `naklios.theme.onChange` for theme.

### A4. Standalone behavior (Q1)
Outside NakliOS, the vendored SDK exposes a `browser` filesystem backend backed by IndexedDB. The full library, reading positions, bookmarks, notes, cached covers, filtering, recovery, and removal flows are available. Storage remains local to the browser profile and origin. Optional AI is host-mediated inside NakliOS or uses a visible local/remote BYOK provider in standalone mode; reading and lexical search do not depend on it.

### A5. Book identity (Q2)
`bookId` is a slugified filename (extension stripped, non-alnum → underscore, trimmed). Collisions get numeric suffixes (`_2`, `_3`). Sidecar carries a `sourceFilename` field for collision detection and future rename-recovery.

### A6. Library discovery (Q3)
Scan-on-load: `naklios.fs.list('library/')` at launch + on window-focus (500ms debounce). Sort by sidecar `lastOpened` desc, then filename mtime desc. Display filename (or sidecar `title` if available). No covers in v1; no `apps/books/index.json`.

### A7. Reading-position schema (Q4)
Engine-discriminated position object. The full sidecar shape is in [Schema additions](#schema-additions) below.

### A8. Adding books (Q5) — revised post-v1
Three paths in hosted mode, two in standalone:
- **Drop a file** onto the window → written to `library/<name>` through the active Browser, Folder, or Crate backend, then opened if single or just added if multiple.
- **Click "+ Add book"** in the library view (or the empty state) → opens the file picker (`<input type="file" multiple accept="…">`); same behavior as drop.
- **Sideload via Finder/Files.app** into the user's `apps/books/library/` folder → picked up on next scan (window-focus debounced) per A6.

Drop overlay appears on any drag-enter (when not already in the reader view) as a visual "drop to add" prompt covering the whole window. Reader-view drag-drop is intentionally disabled — drops while reading shouldn't replace the current book.

The original Q5 lock ("sideload only for v1") was reversed when the user reported that drag-drop didn't work inside the NakliOS iframe — there was no drop zone in hosted mode at all, and no in-app pick-a-file path either. The revised behavior is what should have shipped in v1.

### A9. Notes v1 scope (Q6)
- **Bookmarks**: array on sidecar, `{id, label?, ts, position}` per entry. Position shape matches the book's engine.
- **Per-book free-text note**: single `note: string` field on sidecar. `<pre>`-rendered in v1.
- **No inline highlights** in v1. Deferred.

### A10. Reader engine (Q7) — three engines

During Phase 2 implementation we discovered foliate-js doesn't natively support plain-text formats (`.txt`, `.md`, `.html`). A tiny inline `TextEngine` was added to keep the v1 format scope (A11) intact:

- **FoliateEngine** → `.epub` `.mobi` `.azw3` `.fb2` (wraps foliate-js's `<foliate-view>` element)
- **PdfEngine** → `.pdf` (wraps pdf.js, continuous-scroll canvas viewer)
- **TextEngine** → `.txt` `.md` `.html` `.htm` (`<pre>` for TXT/MD, sandboxed `srcdoc` iframe for HTML)

Internal `Engine` interface (all three implement):
```js
class Engine {
  async load(fileOrBlob)
  getPosition()                  // shape matches engine field
  async jumpTo(position)
  onRelocate(callback)           // internally debounced
  destroy()
}
```
**Vendored, not CDN.** Both libraries checked into `Books/vendor/<lib>@<version>/` and loaded via relative paths. Pinned: `foliate-js@1.0.1`, `pdfjs-dist@5.7.284`. Project-wide preference per memory entry [feedback_vendor_over_cdn](../../.claude/projects/-Users-chiragpatnaik-Code-naklios-universe-naklOS/memory/feedback_vendor_over_cdn.md). Manual upgrades = `mv vendor/<lib>@<old> vendor/<lib>@<new>` + smoke-test, never silent.

### A11. v1 format scope (Q8)
Enabled: `.epub`, `.pdf`, `.mobi`, `.azw3`, `.fb2`, `.txt`, `.md`, `.html`, `.htm`. CBZ + CBR remain deferred (shared comic-mode reader; CBZ via `fflate`, CBR via `node-unrar-js`'s UnRAR-WASM). DjVu / legacy AZW are rejected with workarounds documented in [DEFERRED.md](DEFERRED.md).

### A12. v1.1 storage and library behavior

- The vendored SDK consumes `fsBackends` and `fsBackend`, and exposes `naklios.fs.useBackend(id)`.
- NakliOS mediates every explicit backend change and explains that the target is a separate library. Nothing is copied or deleted.
- Pending sidecar writes are awaited before a switch.
- Adding a filename that already exists is rejected; Books never silently overwrites a book.
- Removal deletes the selected book and its matching sidecar only after an in-app modal confirmation.
- The library can be filtered and sorted by recent activity, title, or author.

### A13. v1.1 reader appearance

Reflowable formats and plain text support font size, line height, text width, and system/paper/sepia/night profiles. Global defaults live in local preferences because they are UI settings, not canonical library data. A hosted book stores its active override in the book sidecar. PDFs keep their authored page layout.

### A14. v1.4 standalone storage and deployment

- Top-level visits expose a `browser` backend implemented as an IndexedDB
  virtual filesystem; iframe visits continue to use NakliOS capabilities and
  RPC storage.
- The Browser, Folder, and Crate backends share one filesystem contract but
  never copy data between one another.
- `navigator.storage.persist()` is requested on the first standalone add as a
  best-effort protection against storage eviction.
- Cloudflare Workers serves the app and vendored engines as static assets at
  `books.naklitechie.com`.
- Cloudflare Workers Builds watches `NakliTechie/Books` `main` and deploys
  `npx wrangler deploy` after each push.

## Schema additions

### Sidecar — `apps/books/notes/<bookId>.json`

```json
{
  "bookId": "pride_and_prejudice",
  "sourceFilename": "Pride and Prejudice.epub",
  "title": "Pride and Prejudice",
  "author": "Jane Austen",
  "format": "epub",
  "engine": "foliate",
  "position": {
    "fraction": 0.34,
    "cfi": "epubcfi(/6/12!/4/2/2[chap03]:147)",
    "sectionIndex": 5
  },
  "lastOpened": "2026-05-18T12:34:56Z",
  "note": "",
  "readerPrefs": {
    "fontSize": 17,
    "lineHeight": 1.7,
    "pageWidth": 720,
    "profile": "system"
  },
  "bookmarks": [
    {
      "id": "bm_a7c3f9d2",
      "label": "the duel",
      "ts": "2026-05-18T12:34:56Z",
      "position": { "fraction": 0.34, "cfi": "epubcfi(...)", "sectionIndex": 5 }
    }
  ]
}
```

**Position shape varies by `engine` field**:
- `engine: "foliate"` → `{ fraction: number, cfi?: string, sectionIndex: number }`. `cfi` populated only for EPUB; MOBI/AZW3/FB2 use `fraction` + `sectionIndex`.
- `engine: "pdf"` → `{ page: number, scrollY: number }`. `scrollY` is `0..1` within the page.
- `engine: "text"` → `{ fraction: number }`. Single scroll-fraction for TXT/MD/HTML.

**Field semantics**:
- `bookId` — slugified filename (A5).
- `sourceFilename` — verbatim filename in `library/`. Used for collision detection and orphan recovery.
- `title` / `author` — extracted from file metadata on first open (lazy).
- `lastOpened` — ISO 8601; drives library sort order (A6) and "continue reading" rail (future).
- `bookmarks[].position` — same shape as top-level `position`; engine-discriminated by the book's engine.
- `readerPrefs` — optional v1.1 per-book appearance override; absent sidecars use the local global default.

### Library index — `apps/books/index.json`

**Not in v1.** A6 locks library discovery to scan-on-load. The index file does not exist.

## Endpoints / public surface

No application HTTP endpoints. The public surface is `https://books.naklitechie.com/`, used both standalone and embedded in NakliOS as a cross-origin iframe. Standalone mode gets its persistent Browser backend; hosted mode gets Folder and Crate backends via the SDK's `naklios.fs.*` RPC.

## Build sequence

**Phase 1 — Foundation**
1. Replace [naklOS/apps/books/index.html](../naklOS/apps/books/index.html) stub with a minimal app shell: theme tokens (CSS custom properties wired to `naklios.theme.onChange`), inline `naklios.js` SDK, capability-detection at boot.
2. Capability branch (A4):
   - top-level + IndexedDB → expose the Browser backend and render the full library.
   - hosted + `capabilities.fs === false` → render the NakliOS storage recovery state.
   - `capabilities.fs === true` → render library shell.
3. Library shell: call `naklios.fs.list('library/')`. Empty → sideload empty-state copy (A8). Non-empty → list rows.

**Phase 2 — Engine adapter + readers**
1. Define `Engine` interface (A10) in `index.html`.
2. Write `FoliateEngine` wrapper. Load the pinned vendored foliate-js build. Smoke-test against EPUB.
3. Write `PdfEngine` wrapper. Load the pinned vendored pdf.js build. Smoke-test against PDF.
4. Format-detection at file open: extension → engine, per A10.
5. Smoke-test corpus: one DRM-free file per enabled format (A11). All 8 must render and surface a position object.

**Phase 3 — Persistence + reopen flow**
1. On book open: `naklios.fs.exists('notes/<bookId>.json')` →
   - Exists: read sidecar, seed `Engine.jumpTo(sidecar.position)` after load.
   - Missing: init empty sidecar (with extracted `title` + `author` populated lazily after first render).
2. Debounced writes (1s after last `onRelocate` event) update sidecar's `position` + `lastOpened`.
3. Library list decoration: items with sidecars show "last read N ago"; sort uses `lastOpened`.
4. Sidecar carries `sourceFilename` (A5) for collision detection.

**Phase 4 — Notes + polish + launcher hand-off**
1. Bookmarks UI: side panel listing `bookmarks[]`. "Bookmark here" button writes one with current `position`. Click-to-jump invokes `Engine.jumpTo`. Remove button deletes from array.
2. Per-book free-text note: textarea, debounced write to sidecar `note` field.
3. Theme integration: `naklios.theme.onChange` → swap CSS custom properties on `:root`. (Already partly done in Phase 1.)
4. **Launcher hand-off** (cross-origin, no mirroring — A0):
   - In NakliOS's `index.html` APPS array, point the production `url` and `embedUrl` at `https://books.naklitechie.com/`.
   - Delete the stub at `naklOS/apps/books/index.html` (no longer used).
   - Do **not** add `books` to `naklOS/apps/manifest.json` — Books is cross-origin, not mirrored.
   - Deploy the `NakliTechie/Books` `main` branch through Cloudflare Workers Builds.

## What this spec deliberately leaves out

The canonical list with revisit triggers lives in [DEFERRED.md](DEFERRED.md). Summary:

- **Cover thumbnails** — text-only library list.
- **Inline highlights** — bookmarks + free-text note covers v1; highlights need text-selection coordination.
- **Search** — out of v1.
- **Multiple libraries / shelves** — one flat `library/`.
- **Cross-device sync conflict resolution** — assumed handled by underlying file-system semantics; revisit when wired to private-mesh.
- **CBZ + CBR** (deferred, shared comic-mode reader); **DjVu / legacy AZW** (rejected with workarounds).
- **Rename / orphan recovery flow** — sidecars survive renames mechanically; rebind UI remains future work.

## References

- [walkthroughs.md](walkthroughs.md) — locked walkthrough questions
- [DEFERRED.md](DEFERRED.md) — items pushed to v2+
- [README.md](README.md) — quickstart + status
- NakliOS SDK source: `../naklOS/sdk/naklios.js`
- foliate-js: https://github.com/johnfactotum/foliate-js
- pdf.js: https://github.com/mozilla/pdf.js
