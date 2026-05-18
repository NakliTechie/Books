# books — Walkthroughs

> **Lifecycle:** `locked` — all questions closed 2026-05-18. Locked decisions are summarised below; each is folded into [SPEC.md](SPEC.md) as an A-numbered architectural decision (A4–A11).

## Locked questions (index)

1. **Standalone behavior** — ✅ LOCKED 2026-05-18. Preview-only outside nakliOS — drag-drop one file, in-memory render, no persistence.
2. **Book identity** — ✅ LOCKED 2026-05-18. Slugified filename. Collisions get numeric suffixes.
3. **Library index** — ✅ LOCKED 2026-05-18. Scan-on-load via `naklios.fs.list('library/')`. No maintained index in v1.
4. **Reading-position schema** — ✅ LOCKED 2026-05-18. Engine-discriminated: foliate-engine formats use `{fraction, cfi?, sectionIndex}`; PDF uses `{page, scrollY}`.
5. **Adding books** — ✅ LOCKED 2026-05-18. Sideload only for v1.
6. **Notes v1 scope** — ✅ LOCKED 2026-05-18. Bookmarks list + per-book free-text note. Inline highlights deferred.
7. **Reader engine** — ✅ LOCKED 2026-05-18. Hybrid (`foliate-js` + `pdf.js`), with internal `Engine` adapter to insulate from upstream churn.
8. **Format scope for v1** — ✅ LOCKED 2026-05-18. EPUB, PDF, MOBI, AZW3, FB2, TXT, MD, HTML. CBZ deferred to v1.1.

---

## Question 1 — Standalone behavior

> **Status:** ✅ LOCKED 2026-05-18. Preview-only outside nakliOS; full library + persistence only when hosted.

### Locked decisions

1. **Standalone is preview-only.** When `naklios.capabilities.fs === false`, the app renders a single drag-drop zone. One file at a time, in-memory render, no persistence, no library, no notes.
2. **Library view is host-only.** Library grid and per-book sidebars only appear when the host has a folder connected.
3. **Empty-state copy in standalone:** "Books works fully inside nakliOS — your library, position, and notes persist to your folder. Standalone, you can read one file at a time. Drop a book here to read."

### Build sequence delta

Phase 1 gets a capability-detection branch at boot. If `capabilities.fs === false` after subscribing via `naklios.onCapabilitiesChange` (with a brief listen window for late-arriving capabilities messages), render the standalone drag-drop UI. Otherwise render the library shell.

---

## Question 2 — Book identity

> **Status:** ✅ LOCKED 2026-05-18. Filename, extension stripped, slugified. Collisions get numeric suffixes.

### Locked decisions

1. **`bookId` is derived from filename**, per the function:
   ```js
   function bookIdFor(filename) {
     return filename
       .replace(/\.[a-z0-9]{2,5}$/i, '')   // strip extension
       .replace(/[^a-zA-Z0-9-]+/g, '_')    // non-alnum → underscore
       .replace(/^_+|_+$/g, '');           // trim leading/trailing _
   }
   ```
2. **Collision rule**: if `notes/<id>.json` already exists for a *different* source filename (recorded as `sourceFilename` field in the sidecar), the new book gets `<id>_2`, `<id>_3`, etc. First-come, first-served.
3. **Rename recovery**: if a sidecar's `sourceFilename` no longer matches any file in `library/`, the sidecar is treated as orphaned. Surface in a v1.1 "rebind orphaned notes" flow (deferred). For v1, orphans are quietly visible in the library if they have `lastOpened` data; user can ignore.

### Build sequence delta

Phase 3: every sidecar carries a `sourceFilename` field for collision detection and future rename-recovery.

---

## Question 3 — Library index

> **Status:** ✅ LOCKED 2026-05-18. Scan-on-load. No `apps/books/index.json` in v1.

### Locked decisions

1. **Library list** comes from `naklios.fs.list('library/')` at launch and on window-focus (debounced 500ms).
2. **Sort order**: by `lastOpened` from sidecars (descending) for books that have been opened, then by filename mtime (descending) for the rest. New books bubble to the top.
3. **Display**: filename (extension trimmed). If the sidecar exists and has a `title` field (populated on first open), show that instead.
4. **No covers in v1.** Deferred. Text-only list.

### Build sequence delta

Phase 1: library shell calls `naklios.fs.list('library/')` and renders a flat list. Phase 3: list rows decorated with `lastOpened` timestamp + title (from sidecar) once those exist.

---

## Question 4 — Reading-position schema

> **Status:** ✅ LOCKED 2026-05-18. Engine-discriminated position object.

### Locked decisions

1. **Sidecar shape** — `apps/books/notes/<bookId>.json`:
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
     "bookmarks": []
   }
   ```
2. **Position shape varies by `engine`**, not by `format`:
   - `engine: "foliate"` → `position: { fraction, cfi?, sectionIndex }`. `cfi` only populated for EPUB; other foliate formats use `{fraction, sectionIndex}` only.
   - `engine: "pdf"` → `position: { page, scrollY }` where `scrollY` is `0..1` fraction within the page.
3. **`lastOpened`** is used for library sort order (Q3) and is updated on every relocate-debounced write (Phase 3).
4. **`title` and `author`** are populated lazily — on first open they're extracted from the file's metadata (foliate-js exposes both; pdf.js requires reading the PDF info dict).
5. **Migration**: shape is versioned implicitly via field presence. If we add a `schemaVersion` later, missing field = v1.

### Build sequence delta

Phase 2: each `Engine` implementation returns `getPosition()` in the shape matching its engine field. Phase 3: write/read sidecar using this exact structure.

---

## Question 5 — Adding books

> **Status:** ✅ LOCKED 2026-05-18. Sideload only for v1. In-app drag-drop deferred.

### Locked decisions

1. **Books are added by dropping files into `apps/books/library/` via the user's file manager** (Finder, Files.app, etc.). Books re-scans on next launch and on window-focus.
2. **Empty-state copy** (when library is empty):
   > "Drop ePub, PDF, MOBI, AZW3, FB2, or text files (.txt/.md/.html) into `apps/books/library/` in your nakliOS folder. They'll appear here."
3. **No in-app file-write code path in v1.** When Books is run standalone, the drag-drop zone reads in-memory only (per Q1's preview-only lock) — it does not write to any folder.

### Build sequence delta

Phase 1: empty-state component renders the locked copy when `naklios.fs.list('library/')` returns an empty array.

---

## Question 6 — Notes v1 scope

> **Status:** ✅ LOCKED 2026-05-18. Bookmarks + per-book free-text note. Inline highlights deferred to v1.1+.

### Locked decisions

1. **Bookmarks** — array on sidecar:
   ```json
   { "bookmarks": [
     { "id": "bm_<random8>", "label": "", "ts": "2026-05-18T...Z",
       "position": { "fraction": 0.34, "cfi": "...", "sectionIndex": 5 } }
   ]}
   ```
   - `label` optional; empty means "unlabeled bookmark." UI shows label or fallback like "p.47 · 34%."
   - Position shape matches the book's `engine` (Q4 lock).
2. **Free-text note** — `note: string` (single textarea per book). Markdown-ish but rendered as `<pre>` in v1.
3. **Inline highlights deferred.** Stub copy at `naklOS/apps/books/index.html` currently says "Highlights + margin notes" — needs updating to "Bookmarks + notes" to match what v1 ships. This is part of Phase 4's stub-replacement step.

### Build sequence delta

Phase 4: bookmarks panel UI (list, add-here button, remove, click-to-jump), free-text-note textarea, both wired to sidecar via debounced write. Update naklOS stub copy.

---

## Question 7 — Reader engine

> **Status:** ✅ LOCKED 2026-05-18. Hybrid — foliate-js for everything except PDF; pdf.js for PDF. Internal `Engine` adapter insulates the app from upstream churn.

### Locked decisions

1. **Engine assignment by file extension**:
   - `.epub` `.mobi` `.azw3` `.fb2` `.txt` `.md` `.html` `.htm` → **FoliateEngine** (wraps foliate-js)
   - `.pdf` → **PdfEngine** (wraps pdf.js)
2. **Internal `Engine` interface** — all engine wrappers implement:
   ```
   class Engine {
     async load(file)             // file is File | Blob
     getPosition()                // returns the position object matching this engine's shape
     async jumpTo(position)       // accepts the same shape
     onRelocate(callback)         // fires on user scroll/page-turn; debounced internally
     destroy()                    // cleanup
   }
   ```
3. **Pinned dependencies**:
   - `foliate-js`: pinned to a tagged release (latest stable, currently 1.0.1) via CDN with SRI hash. Manual upgrade after smoke-test.
   - `pdf.js`: pinned to a stable release via CDN with SRI hash.
4. **Vendoring strategy**: CDN loads, not inline vendoring. Reasoning: foliate-js + pdf.js together are ~600 KB; inlining them blows the single-file index.html size to a point where editing is painful. We accept a CDN dependency for these two; the rest of the app (UI, persistence, engine adapter) stays inline.
5. **Adapter layer is the abstraction**: the rest of Books only talks to the `Engine` interface. If foliate-js's API breaks (their README warns it might), only the FoliateEngine wrapper file changes.

### Build sequence delta

Phase 2 (revised):
1. Define the `Engine` interface in `index.html` (no external file).
2. Write `FoliateEngine` wrapper. Smoke-test against one EPUB.
3. Write `PdfEngine` wrapper. Smoke-test against one PDF.
4. Format-detection at load: dispatch to the correct engine based on extension.

---

## Question 8 — Format scope for v1

> **Status:** ✅ LOCKED 2026-05-18. v1 ships EPUB + PDF + MOBI + AZW3 + FB2 + TXT + MD + HTML. CBZ deferred to v1.1.

### Locked decisions

1. **v1 enabled formats**: `.epub`, `.pdf`, `.mobi`, `.azw3`, `.fb2`, `.txt`, `.md`, `.html`, `.htm` (the last two share one engine path).
2. **Deferred to v1.1**: `.cbz` (image-paginated UX is a separate track — see [DEFERRED.md](DEFERRED.md)).
3. **Rejected** (with documented workarounds in [DEFERRED.md](DEFERRED.md)):
   - `.cbr` — no usable JS RAR-decompression library. Workaround: convert to `.cbz`.
   - `.djvu` — heavyweight WASM. Workaround: convert to PDF.
   - Legacy `.azw` (pre-AZW3) — obsolete; foliate-js doesn't support. Workaround: convert via Calibre.
4. **Test corpus** (smoke-test books for Phase 2):
   - EPUB: Project Gutenberg's *Pride and Prejudice* (canonical EPUB test text)
   - PDF: any DRM-free public-domain technical PDF
   - MOBI: a Gutenberg MOBI export
   - AZW3: a Gutenberg KF8 export (or a Calibre-converted EPUB → AZW3)
   - FB2: a Gutenberg FB2 export
   - TXT/MD/HTML: synthetic test files (small)
5. **Sideload empty-state copy** (from Q5) explicitly lists the enabled formats so users know what works.

### Build sequence delta

Phase 2: format-detection switch covers all 8 extensions (mapping them to engines per Q7). Phase 4: empty-state copy and any "supported formats" help text reflect this list.

---

## Pattern reference: locked sections follow this shape

Status banner → numbered locked decisions → build sequence delta. The "Options being considered" tables from the draft phase live in git history (commit `a02eddc` for Q1–Q6, `ccdbcce` for Q7–Q8). Not duplicated here.
