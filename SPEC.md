# books — Spec

> **Lifecycle:** `locked` — all walkthrough questions closed 2026-05-18. Implementation can start.

## Goal

A single-file, browser-native reader for ePub, PDF, MOBI, AZW3, FB2, TXT, Markdown, and HTML — slotted into nakliOS as the `books` app. The user's books live in their connected nakliOS folder at `apps/books/library/*`; reading position + bookmarks + per-book notes persist as sidecar JSON at `apps/books/notes/<bookId>.json`. Because the data is just files in the user's folder, the library is portable across devices and outlives the launcher.

Success v1: open any supported format from the library, read to completion, close, reopen — position is exactly where it was. Works inside nakliOS (folder access via the host's SDK) and degrades to preview-only when run standalone.

## Architectural decisions

### A0. App ID + mount point
`id:'books'`, served from `https://naklitechie.github.io/Books/` (its own GitHub Pages site). **Cross-origin to naklOS**, not mirrored. Books doesn't need same-origin — it never calls `showDirectoryPicker` itself (A4 standalone is preview-only via drag-drop; hosted FSA goes through `naklios.fs.*` postMessage RPC which is cross-origin-safe). Retaining the cross-origin sandbox + privacy badge per the naklOS series convention. The Books-related entry in naklOS v2.18's APPS list is currently set to `naklios.dev/apps/books/`; that needs to flip to `naklitechie.github.io/Books/` in Phase 4. The mirror stub at `naklOS/apps/books/index.html` is deleted in Phase 4.

### A1. Single-file-app + vendored libraries
The app code itself is one `index.html` — markup, styles, logic inline. Third-party libraries (`foliate-js`, `pdfjs-dist`) are **vendored** under `Books/vendor/<lib>@<version>/` and loaded via relative `<script>` paths. No runtime CDN dependency. See A10 for engine details. An internal `Engine` adapter interface insulates app code from library churn.

### A2. Data path convention
All persistence under `apps/books/` in the host folder, via `naklios.fs.*` RPC. Subdirs:
- `apps/books/library/` — the books themselves (one file per book)
- `apps/books/notes/<bookId>.json` — per-book sidecar (position, bookmarks, note)

No `localStorage` or `IndexedDB` for canonical state.

### A3. SDK contract
Vendor `naklios.js` inline (sdk surface v1). Call `naklios.ready()` after init; `naklios.title('Books — <book-title>')` on book open; subscribe to `naklios.onCapabilitiesChange` for fs availability and to `naklios.theme.onChange` for theme.

### A4. Standalone behavior (Q1)
Outside nakliOS (`capabilities.fs === false`), Books is preview-only — a single drag-drop zone, in-memory render, no persistence, no library, no notes. Library + notes + bookmarks UI only appears when hosted.

### A5. Book identity (Q2)
`bookId` is a slugified filename (extension stripped, non-alnum → underscore, trimmed). Collisions get numeric suffixes (`_2`, `_3`). Sidecar carries a `sourceFilename` field for collision detection and future rename-recovery.

### A6. Library discovery (Q3)
Scan-on-load: `naklios.fs.list('library/')` at launch + on window-focus (500ms debounce). Sort by sidecar `lastOpened` desc, then filename mtime desc. Display filename (or sidecar `title` if available). No covers in v1; no `apps/books/index.json`.

### A7. Reading-position schema (Q4)
Engine-discriminated position object. The full sidecar shape is in [Schema additions](#schema-additions) below.

### A8. Adding books (Q5)
Sideload only for v1. Users drop files into `apps/books/library/` via Finder / Files.app / etc. In-app drag-drop deferred to v1.1.

### A9. Notes v1 scope (Q6)
- **Bookmarks**: array on sidecar, `{id, label?, ts, position}` per entry. Position shape matches the book's engine.
- **Per-book free-text note**: single `note: string` field on sidecar. `<pre>`-rendered in v1.
- **No inline highlights** in v1. Deferred.
- naklOS apps/books/index.html stub copy must be updated from "Highlights + margin notes" to "Bookmarks + notes" to match what ships.

### A10. Reader engine (Q7) — three engines

During Phase 2 implementation we discovered foliate-js doesn't natively support plain-text formats (`.txt`, `.md`, `.html`). A tiny inline `TextEngine` was added to keep the v1 format scope (A11) intact:

- **FoliateEngine** → `.epub` `.mobi` `.azw3` `.fb2` (wraps foliate-js's `<foliate-view>` element)
- **PdfEngine** → `.pdf` (wraps pdf.js, continuous-scroll canvas viewer)
- **TextEngine** → `.txt` `.md` `.html` `.htm` (no library; `<pre>` for TXT/MD, sandboxed `srcdoc` iframe for HTML)

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
Enabled: `.epub`, `.pdf`, `.mobi`, `.azw3`, `.fb2`, `.txt`, `.md`, `.html`, `.htm`. CBZ + CBR both deferred to v1.1 (shared comic-mode reader; CBZ via `fflate`, CBR via `node-unrar-js`'s UnRAR-WASM). DjVu / legacy AZW rejected with workarounds documented in [DEFERRED.md](DEFERRED.md).

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

### Library index — `apps/books/index.json`

**Not in v1.** A6 locks library discovery to scan-on-load. The index file does not exist.

## Endpoints / public surface

No HTTP endpoints. The app's only public surface is `https://naklitechie.github.io/Books/` (used both standalone and embedded in naklOS as a cross-origin iframe). Standalone mode is preview-only per A4; hosted mode gets the full library experience via the SDK's `naklios.fs.*` RPC.

## Build sequence

**Phase 1 — Foundation**
1. Replace [naklOS/apps/books/index.html](../naklOS/apps/books/index.html) stub with a minimal app shell: theme tokens (CSS custom properties wired to `naklios.theme.onChange`), inline `naklios.js` SDK, capability-detection at boot.
2. Capability branch (A4):
   - `capabilities.fs === false` → render standalone drag-drop zone with the locked empty-state copy.
   - `capabilities.fs === true` → render library shell.
3. Library shell: call `naklios.fs.list('library/')`. Empty → sideload empty-state copy (A8). Non-empty → list rows.

**Phase 2 — Engine adapter + readers**
1. Define `Engine` interface (A10) in `index.html`.
2. Write `FoliateEngine` wrapper. Load foliate-js from pinned CDN URL with SRI. Smoke-test against EPUB.
3. Write `PdfEngine` wrapper. Load pdf.js from pinned CDN URL with SRI. Smoke-test against PDF.
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
   - In naklOS's `index.html` APPS array, change the `books` entry's `url` and `embedUrl` from `https://naklios.dev/apps/books/` → `https://naklitechie.github.io/Books/`.
   - Delete the stub at `naklOS/apps/books/index.html` (no longer used).
   - Do **not** add `books` to `naklOS/apps/manifest.json` — Books is cross-origin, not mirrored.
   - Init NakliTechie/Books GitHub repo, push `booksv1` → `main`, enable GitHub Pages on `main`.

## What this spec deliberately leaves out

The canonical list with revisit triggers lives in [DEFERRED.md](DEFERRED.md). Summary:

- **Reader prefs panel** (font, size, line height, margins) — one good set of defaults in v1.
- **Cover thumbnails** — text-only library list.
- **Inline highlights** — bookmarks + free-text note covers v1; highlights need text-selection coordination.
- **Search** — out of v1.
- **Multiple libraries / shelves** — one flat `library/`.
- **In-app drag-drop add-book** — sideload only.
- **Standalone-mode persistence** — preview-only outside the host.
- **Cross-device sync conflict resolution** — assumed handled by underlying file-system semantics; revisit when wired to private-mesh.
- **CBZ + CBR** (deferred to v1.1, shared comic-mode reader); **DjVu / legacy AZW** (rejected with workarounds).
- **Rename / orphan recovery flow** — sidecars survive renames mechanically; rebind UI is v1.1.

## References

- [walkthroughs.md](walkthroughs.md) — locked walkthrough questions
- [DEFERRED.md](DEFERRED.md) — items pushed to v2+
- [README.md](README.md) — quickstart + status
- naklOS SDK source: `../naklOS/sdk/naklios.js`
- Current Books stub (mirror side): `../naklOS/apps/books/index.html` — to be replaced
- Mirror manifest: `../naklOS/apps/manifest.json` — Books entry added in Phase 4
- foliate-js: https://github.com/johnfactotum/foliate-js
- pdf.js: https://github.com/mozilla/pdf.js
