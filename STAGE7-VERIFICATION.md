# books — Stage 7 verification (Frontend walkthrough)

> **Date:** 2026-05-18. **Branch:** `booksv1`. **Method:** Headless Chromium via Claude Preview MCP, plus user-driven verification (pending) for the binary-format engines.

## Automated checks (Claude Preview)

Ran against a python `http.server` serving the Books repo at `localhost:8801`.

### Boot
- ✅ `index.html` loads to `readyState: 'complete'` without console errors.
- ✅ `window.naklios` SDK initialised; `capabilities.hosted === false`, `capabilities.fs === false` (correct — preview is not iframed by nakliOS).
- ✅ Standalone preview view rendered: card with tag "Preview mode", dropzone visible, topbar status "Preview mode".

### TextEngine path (drop a `.txt` file)
- ✅ Synthetic `DragEvent('drop', …)` with `DataTransfer.items.add(file)` triggers `openBookFromFile`.
- ✅ Reader view opens; title set from filename ("stage7-smoke"); status pill shows "0%" (TextEngine's `{fraction}` position).
- ✅ Content rendered as `<pre>` inside scrollable container; text matches input.
- ✅ Sidebar toggle correctly hidden in standalone mode (A4 — no persistence, no bookmarks/note surface).

### Unsupported-format rejection
- ✅ Dropping `evil.exe` enters reader view (was a pre-fix bug — error rendered into hidden DOM).
- ✅ Error card shows: heading "Couldn't open this book", body "Unsupported file type: `<code>.exe</code>`" with XSS-safe escaping.
- ✅ Bug fix committed: hoisted `enterReaderView` + `setReaderLoading` above the engine-key check in `openBookFromFile`.

### Lifecycle
- ✅ Back-to-library button (`← Library`) properly closes reader view; `is-open` class removed; topbar + main view restored.
- ✅ Second drop after exit re-opens reader cleanly (engine teardown working).

### Visual (Mumbai art deco palette)
- ✅ Screenshot (committed via PR review) confirms cream body, teal-black ink, Georgia serif for the TextEngine `<pre>`, reader header chrome readable. Layout works at the preview's default viewport.

## User-driven verification (pending)

The headless preview can't reliably exercise the binary formats without real test files on disk. The following needs manual verification before merging `booksv1` → `main`:

### Smoke corpus (DRM-free, from Project Gutenberg)
For each format, drop into the standalone preview and verify it renders + position pill updates on scroll:

| Format | Suggested test file | Verify |
|---|---|---|
| EPUB    | https://www.gutenberg.org/cache/epub/1342/pg1342.epub3.images (Pride & Prejudice) | Foliate renders; pages flow; position pill shows `%` |
| MOBI    | https://www.gutenberg.org/ebooks/1342.mobi.images | Foliate opens; renders |
| AZW3    | Calibre-convert any EPUB → AZW3 (no Gutenberg direct) | Foliate opens |
| FB2     | https://www.gutenberg.org/cache/epub/1342/pg1342.fb2 (if available) | Foliate opens |
| PDF     | https://www.gutenberg.org/files/1342/1342-pdf.pdf | pdf.js renders pages; status shows `p.N · X%` |
| TXT     | (any text file) | TextEngine renders `<pre>` — already verified above |
| MD      | (any `.md` file) | TextEngine renders `<pre>` (no MD-to-HTML in v1) |
| HTML    | (any `.html` file) | TextEngine srcdoc-iframe renders with `sandbox=""` — no scripts |

### Hosted-mode verification (inside nakliOS)
Standalone preview can't exercise the persistence path (`naklios.fs.*` requires a real host). Once Books is pushed to a github.io site:

1. Copy a few books into the user's nakliOS folder under `apps/books/library/`.
2. Open Books from the nakliOS launcher.
3. Verify library list populates with filenames.
4. Open a book; scroll; close; reopen — position should be preserved.
5. Add a bookmark; rename; remove; click to jump.
6. Type into the per-book note; close; reopen — note should be preserved.
7. Verify `apps/books/notes/<bookId>.json` files appear in the user's folder with the expected schema.

## Conclusion

Automated smoke covers the engine-agnostic plumbing (capability detection, open/close lifecycle, error UX, position tracking). Format-specific rendering and the full persistence loop need to be exercised with real books in nakliOS — that work is user-driven and gated on the Books github.io site existing.

One bug found and fixed during this stage: unsupported-format errors used to render into a hidden reader-content div because `showReaderError` was called before `enterReaderView`. Fixed in the same commit batch as this doc.
