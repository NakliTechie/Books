# books — Walkthroughs

> **Lifecycle:** `draft` — open design questions. Each question moves from `🟡 OPEN` to `✅ LOCKED <date>` as it's settled. The doc flips to `locked` when every question is closed.

These are the *scope-defining* questions for Books — not implementation details. Many decisions the stub copy already implies (library view, epub.js/pdf.js, `apps/books/library/*` layout) are baked into [SPEC.md](SPEC.md). The questions below are the genuinely-open ones that could swing the design.

## Open questions

1. **Standalone behavior — what happens when there's no nakliOS host?** — 🟡 OPEN
2. **Book identity — what's the stable key?** — 🟡 OPEN
3. **Library index — scan-on-load or maintained file?** — 🟡 OPEN
4. **Reading-position schema — one shape across formats?** — 🟡 OPEN *(shape depends on Q7)*
5. **Adding books — sideload only, drag-drop in app, or both?** — 🟡 OPEN
6. **Notes v1 scope — bookmark, free-text, or full highlights?** — 🟡 OPEN
7. **Reader engine — `epub.js + pdf.js`, `foliate-js`, or hybrid?** — 🟡 OPEN *(upstream of Q4 and Q8)*
8. **Format scope for v1 — which formats does the loader switch enable?** — 🟡 OPEN *(answered by Q7's lock)*

Add questions as they emerge. Number stably — never renumber.

---

## Question 1 — Standalone behavior

> **Status:** 🟡 OPEN

When Books is opened outside nakliOS (directly via `naklitechie.github.io/Books/` or the GitHub Pages mirror), `naklios.capabilities.fs` is `false` and the `fs.*` RPCs reject. What should the app do?

### Options being considered

| Option | How | Pros | Cons |
|---|---|---|---|
| A. Refuse outside host | Show a "Books is part of nakliOS — open it from naklios.dev" card. | Simplest. No dual code path. | Breaks the "every app works standalone" series-wide pattern. Bad first-impression for someone landing on the canonical URL. |
| B. Preview-only | Drag-drop a single file → render in memory, **no persistence**. No library view. | Honors single-file ethos. Lets people try the reader without nakliOS. | Two distinct UX flows in one file. Reading position lost on close. |
| C. Self-pickered (Tijori pattern) | Call `showDirectoryPicker()` on first run, save handle to IndexedDB, write files into the picked folder directly. | Full feature parity standalone. Tijori already proves the shape. | Adds ~80 LOC and a second code path. Lock-in risk: standalone-picked folder ≠ host-connected folder, library splits across two locations if user does both. |

### My recommendation

**B (preview-only).** A naklOS app's job is to feel native inside nakliOS first. Preview-only is honest — it says "this works fully when you mount it in nakliOS, but here's a taste." Tradeoff: drops standalone persistence (you'd reopen the book and lose position). Tripwire that would flip to C: if you actually want Books to be usable as a stand-alone reader on someone else's machine without the launcher.

### Decisions to lock

1. Standalone behavior (one of A/B/C).
2. If B or C, how the single-file drag-drop UX surfaces in standalone but is hidden in hosted mode.

---

## Question 2 — Book identity

> **Status:** 🟡 OPEN

The sidecar at `apps/books/notes/<book-id>.json` needs a stable key. Filename-based breaks when the user renames a file. Content-hash is stable but renders the file unreadable until hashed (slow on a 50 MB PDF). ePub's `<dc:identifier>` is stable but only exists in ePub (PDF has no equivalent).

### Options being considered

| Option | How | Pros | Cons |
|---|---|---|---|
| A. Filename (extension stripped) | `Pride_and_Prejudice.epub` → `Pride_and_Prejudice` | Trivial. Human-readable sidecars. | Rename = orphaned notes. Two files with same stem collide. |
| B. Content hash (sha256 of first N MB) | Hash on first open, cache in library index | Stable across renames. | Slow for big PDFs. Bytes-identical re-downloads keep notes; identical-content-different-file does not. |
| C. Format-native ID with filename fallback | ePub: `<dc:identifier>` (parsed from META-INF). PDF: filename. | Best identifier per format. | Two code paths. PDF still has filename-fragility problem. |
| D. UUID assigned at first scan | Maintained index `{filename → uuid}` | Survives renames if the index is updated when filename changes. | Index becomes load-bearing — if it's lost, all notes orphan. |

### My recommendation

**A (filename, extension stripped, slugified).** Simplest, most readable on-disk. Users editing their library know what each sidecar belongs to at a glance. Tradeoff: renames orphan notes. Tripwire that would flip to C or D: if real users rename books often (likelier on imported library content from Calibre etc.).

If we go A: a tiny "Notes orphaned — pick the book they belong to" recovery flow could mitigate without changing the identity scheme.

### Decisions to lock

1. The identity function (which option).
2. Collision behavior if two files slug to the same id (suffix? error?).

---

## Question 3 — Library index

> **Status:** 🟡 OPEN

How does Books discover the books in `apps/books/library/`? Every app launch calls `naklios.fs.list('library/')` (fast, no per-file metadata), or we maintain `apps/books/index.json` with extracted metadata (title, author, last-read, optional cover).

### Options being considered

| Option | How | Pros | Cons |
|---|---|---|---|
| A. Scan-on-load only | Each launch: `fs.list('library/')` → list filenames. Cross-reference notes/ for "last read" indicator. | No write side-effect. Library is just files. | No author/title (you see filenames). No covers. |
| B. Maintained `apps/books/index.json` | First-sight of new file: parse metadata, append to index. Library view reads index. | Rich metadata. Fast load. | Index becomes load-bearing — out-of-sync if user adds files via Finder. Need reconcile pass. |
| C. Hybrid — index as cache, scan reconciles | Index is opportunistically maintained; missing entries trigger lazy parse. | Best of both. | Most code. Most edge cases (deletes, renames, partial-index). |

### My recommendation

**A for v1 (scan-on-load).** Show filenames in the library, sort by mtime descending. When you open a book, parse its metadata once (epub.js gives you title/author free during render init) and update the sidecar's `title` field — that's enough metadata for the "last read" stripe. Tradeoff: library view is filename-based, looks rougher than Calibre. Tripwire: when "I can't find a book by title" becomes a friction point, move to C.

### Decisions to lock

1. Scan vs maintained vs hybrid.
2. If scan-only: what's shown in the library (filename only, or filename + sidecar-derived "title" when available?).

---

## Question 4 — Reading-position schema

> **Status:** 🟡 OPEN — exact shape locks AFTER Q7 (reader engine), since foliate-js exposes a unified `relocate` event with its own location primitive that differs from raw epub.js CFI.

Different formats have different position primitives. ePub: a Canonical Fragment Identifier (CFI) string, precise to a character offset in a chapter. PDF: page number + intra-page scroll offset (typically `0..1`). MOBI/AZW3: internal section index + offset. CBZ: page-image index. The sidecar JSON should express all needed formats without any format needing another's knowledge.

### Options being considered

| Option | How | Pros | Cons |
|---|---|---|---|
| A. Format-discriminated nested object | `position.epub = { cfi: "..." }` or `position.pdf = { page, scrollY }` | Each format owns its shape. Type-safe per format. | Slightly verbose. Format detection on read. |
| B. Single flat field, opaque string | `position: "epub:epubcfi(..." \| "pdf:47:0.32"` | One field. Easy to debug visually. | String parsing on read. No type-safety on shape. |
| C. Percentage-of-document | `position: 0.34` for both formats | Cross-format, trivially comparable. | Lossy: percentage in a paginated PDF reflows differently than ePub. Reopen lands "approximately." |

### My recommendation

**A (discriminated nested).** Honest about the difference between the two formats. ePub readers downstream can ignore `position.pdf` and vice versa. Tradeoff: slight verbosity. Tripwire to flip to C: if we ever want to share reading position across formats of the same book (probably never).

Schema draft (locks here once chosen):
```json
{
  "bookId": "...",
  "format": "epub",
  "position": { "cfi": "epubcfi(/6/12!/4/2/2[chap03]:147)" },
  "lastOpened": "2026-05-18T...Z"
}
```

### Decisions to lock

1. Schema variant (A/B/C).
2. What `lastOpened` is used for in v1 (sort order? "continue reading" rail? both?).

---

## Question 5 — Adding books

> **Status:** 🟡 OPEN

The library starts empty. How does the user populate it?

### Options being considered

| Option | How | Pros | Cons |
|---|---|---|---|
| A. Sideload only (Finder → folder) | User drags `.epub`/`.pdf` into their nakliOS folder's `apps/books/library/` from Finder. Books reflects on next open. | Zero in-app code. Users with existing libraries (Calibre etc.) just point. | Discovery: how does a new user know? Needs onboarding empty state. |
| B. In-app drag-drop | Drop a file onto the library view → write to `library/` via `naklios.fs.write` (binary). | First-class UX. Onboarding obvious. | Adds binary-write code path. Big PDFs (50+ MB) over postMessage RPC might be slow. |
| C. Both A + B | Default is sideload (just files in a folder), but drag-drop also works in-app. | Convenience without sacrificing the file-folder mental model. | Most code. |

### My recommendation

**A for v1, B in v1.1.** Ship the smaller surface first. Empty state copy: "Drop ePub or PDF files into `apps/books/library/` in your nakliOS folder." Tradeoff: less convenient for first-time users on a fresh setup. Tripwire to add B: when 3+ people ask "how do I add a book?" within the first launch.

### Decisions to lock

1. Sideload-only / in-app-only / both.
2. Empty-state copy (if sideload).

---

## Question 6 — Notes v1 scope

> **Status:** 🟡 OPEN

Stub copy promises "Highlights + margin notes." That's ambitious for v1. What's the minimum that ships?

### Options being considered

| Option | How | Pros | Cons |
|---|---|---|---|
| A. Bookmarks only | Click bookmark icon → record `{ cfi or page, ts, label? }` in sidecar. Sidebar lists bookmarks, click to jump. | Smallest scope. No selection-handling complexity. | Doesn't deliver on "highlights + notes" promise from stub. |
| B. Bookmarks + free-text-per-book note | Above + a textarea-style "my note on this book" — one blob, not per-position. | Tiny addition. Useful for "what did I think of this book?" reflection. | Still doesn't deliver inline highlights. |
| C. Inline highlights with notes | Select text → highlight + optional note. Persist with CFI / page+offset. Render highlights when reopening. | Delivers stub promise. The marquee feature. | Substantial UX: text selection across pages, persistence of overlays, ePub iframe coordination. Could double the build effort. |

### My recommendation

**B for v1, C in v1.1.** Ships the smallest "real" notes feature (bookmarks + a per-book note) in Phase 4 of the build. Tradeoff: stub copy is aspirational for v1. Update stub copy to match what v1 actually delivers, queue C in DEFERRED.md. Tripwire to skip B and go straight to C: if you'd rather Books-v1 be late-and-complete than early-and-spartan.

### Decisions to lock

1. Notes scope for v1 (A/B/C).
2. Update stub copy to match if B is chosen.

---

## Question 7 — Reader engine

> **Status:** 🟡 OPEN — upstream of Q4 (position schema) and Q8 (format scope).

What library does the actual rendering? The naive plan was `epub.js + pdf.js` (one per format). But [foliate-js](https://github.com/johnfactotum/foliate-js) (the engine behind the Foliate desktop reader) renders ePub, MOBI, KF8/AZW3, FB2, CBZ, and experimental PDF — all from a single unified `<foliate-view>` element. That's a real architectural fork.

### Options being considered

| Option | How | Pros | Cons |
|---|---|---|---|
| A. `epub.js` + `pdf.js` (separate) | One library per format, custom loader switch. Add formats by adding libraries. | Each library is mature, stable, well-known. pdf.js is the de facto PDF renderer. epub.js has been stable for years. | Adding a new format = adding a library. CBR/CBZ/MOBI each need their own thing. Two scroll-position models. |
| B. `foliate-js` (unified) | One ES-module library, format-detection at load time, single `relocate` event for position. | EPUB + MOBI + KF8 + FB2 + CBZ free out of the box. PDF too (experimental). One codepath. Modern ES modules, no build step. | foliate-js's own README warns: "library is not stable and users should expect it to break with API changes at any time." PDF is experimental. Smaller ecosystem. |
| C. Hybrid — foliate-js for text+image, pdf.js for PDF | foliate-js handles EPUB/MOBI/AZW3/FB2/CBZ; pdf.js handles PDF. Loader switch picks engine by file extension. | Best of both: foliate's breadth without trusting its experimental PDF; pdf.js's PDF maturity. | Two libraries on the page. Two scroll-position abstractions to reconcile in Q4's schema. Bigger bundle. |

### My recommendation

**C (hybrid).** Single-file ethos says minimize libraries, but the alternative is either trusting foliate-js for PDF (still experimental) or losing the multi-format breadth entirely. The two engines are non-overlapping (foliate-js does everything except PDF; pdf.js does only PDF), so the integration is a clean format-extension switch — no coordination needed.

Mitigations for foliate-js's "unstable API" warning:
1. **Pin to a tagged release** by URL (e.g. `https://cdn.jsdelivr.net/npm/foliate-js@1.0.1/...`) with an SRI hash; manual upgrade after smoke-test.
2. **Adapter layer**: Books's reader code talks to a thin internal `Engine` interface (load, relocate, getPosition, jumpToPosition), and the foliate-js/pdf.js wrappers implement it. Engine churn doesn't ripple to the rest of the app.

Tripwire that would flip to A: if foliate-js breaks twice in six months requiring our code to change, ditch it and write per-format ourselves.
Tripwire that would flip to B: if foliate-js's PDF support reaches parity with pdf.js (would shrink bundle, simplify code).

### Decisions to lock

1. Engine choice (A / B / C).
2. If C: pin version of foliate-js + adapter shape (or defer adapter to Phase 2 spike).
3. Loading strategy — CDN with SRI vs vendor source inline. (Single-file ethos pulls toward vendoring; bundle size pulls toward CDN.)

---

## Question 8 — Format scope for v1

> **Status:** 🟡 OPEN — directly downstream of Q7. Numbers below assume Q7 locks to C (hybrid).

Given the engine, which formats does v1's loader switch actually accept? Enabling each format adds: one extension to the file-picker filter, one branch in the loader switch, one Q4 schema variant, one empty-state copy update, at least one test book in the test corpus.

### Options being considered

| Option | Formats in v1 | Notes |
|---|---|---|
| A. Minimum — original stub scope | EPUB + PDF | Honors the stub's exact promise. Smallest test surface. |
| B. + plain-text family | EPUB + PDF + TXT/MD/HTML | TXT/MD/HTML share one renderer (markdown-to-html, plain-text-to-html, raw-html). ~150 LOC. |
| C. + foliate breadth | EPUB + PDF + TXT/MD/HTML + MOBI + AZW3 + FB2 | If Q7 = C, these are essentially free in code terms (one switch branch each). The cost is test-corpus and edge-case discovery. |
| D. + CBZ | C + CBZ | Adds an image-paginated UI mode (different from text-reflow). ~200 LOC for the comic UX. |

**Rejected outright (don't ship in any v1):**
- **CBR** — rar.js (the available pure-JS RAR library) doesn't implement decompression and has been stale since 2018. No viable path. Document the workaround: convert CBR → CBZ with WinRAR / `unar` / Calibre.
- **DjVu** — heavyweight WASM library (djvu.js); niche audience; not worth the bundle.
- **AZW (legacy, pre-AZW3)** — predates KF8; not supported by foliate-js. Practically obsolete.

### My recommendation

**C.** If we adopt foliate-js (Q7=C), MOBI/AZW3/FB2 become essentially free — denying them just to hold scope tight is silly. **Defer CBZ to v1.1** because its image-paginated UI is a meaningfully different reader surface (different controls, different position model, different empty-state). Including CBZ in v1 doubles UX-design effort for a feature with a smaller audience.

Tradeoff: each enabled format adds at least one empty-state copy update + one test book in the test corpus. Tripwire: if MOBI usage logs (via simple telemetry — out of scope for naklOS today) stay at zero through v1, drop it in v1.1's deprecation pass.

### Decisions to lock

1. Format set (A / B / C / D, or custom selection).
2. Test corpus: which books we use to verify each format renders correctly (one DRM-free public-domain book per format).
3. Empty-state copy update — what extensions to mention in the "drop ePub or PDF files…" message.

---

## Pattern: locked sections look like this

When a question locks, edit its section to:

```
## Question N — <title>

> **Status:** ✅ LOCKED <YYYY-MM-DD>. <one-sentence summary of the decision>

### Locked decisions

1. **<sub-decision>** — locked. <reasoning + implication>

### Build sequence delta

What this lock adds to SPEC.md's build sequence. (Update SPEC.md to match.)
```
