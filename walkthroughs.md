# books — Walkthroughs

> **Lifecycle:** `draft` — open design questions. Each question moves from `🟡 OPEN` to `✅ LOCKED <date>` as it's settled. The doc flips to `locked` when every question is closed.

These are the *scope-defining* questions for Books — not implementation details. Many decisions the stub copy already implies (library view, epub.js/pdf.js, `apps/books/library/*` layout) are baked into [SPEC.md](SPEC.md). The questions below are the genuinely-open ones that could swing the design.

## Open questions

1. **Standalone behavior — what happens when there's no nakliOS host?** — 🟡 OPEN
2. **Book identity — what's the stable key?** — 🟡 OPEN
3. **Library index — scan-on-load or maintained file?** — 🟡 OPEN
4. **Reading-position schema — one shape for ePub + PDF?** — 🟡 OPEN
5. **Adding books — sideload only, drag-drop in app, or both?** — 🟡 OPEN
6. **Notes v1 scope — bookmark, free-text, or full highlights?** — 🟡 OPEN

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

> **Status:** 🟡 OPEN

ePub and PDF have different position primitives. ePub: a Canonical Fragment Identifier (CFI) string, precise to a character offset in a chapter. PDF: page number + intra-page scroll offset (typically `0..1`). The sidecar JSON should express both without either format needing the other's knowledge.

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
