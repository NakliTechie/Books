# books — Security review (Stage 6)

> **Reviewed:** 2026-05-18 against `booksv1` commits `a02eddc..37f648f`.
> **Verdict:** nothing to fix. Notes below for context.

## Scope

The branch covers a from-scratch single-file app + two vendored dependencies (foliate-js@1.0.1, pdfjs-dist@5.7.284) + dev-process docs. Public surface is `https://naklitechie.github.io/Books/`, used both standalone and embedded as a cross-origin iframe in nakliOS.

## Findings

### XSS
Every HTML interpolation in [index.html](index.html) routes through `escapeHtml()`. Surfaces audited:
- Library rows (filename, sidecar `title`, sidecar `author`)
- Bookmark list (label, position description)
- Reader title + status
- Error messages (filename, error.message, ext)

`innerHTML` is set only to static template strings + escaped interpolations. `textContent` is used for `noteArea.value`, `readerTitle.textContent`. No `document.write`, no `eval`, no `new Function`.

### Untrusted HTML rendering (TextEngine)
HTML / HTM files dropped or sideloaded into the library render through a srcdoc iframe with `sandbox=""` — the most restrictive sandbox tier. No scripts, no same-origin, no popups, no top navigation, no form submission. Even an actively-malicious HTML file can't reach the host page or the SDK.

### Network
Books code makes no `fetch` / `XMLHttpRequest` / WebSocket calls. Verified:
- foliate-js: `fetchFile` exists but is only invoked when `view.open()` receives a string URL. Books always passes a `File` object.
- pdfjs-dist: all asset URLs (cMapUrl, standardFontDataUrl, workerSrc) point at local `vendor/pdfjs-dist@5.7.284/` paths.

No runtime CDN dependency.

### postMessage trust
The vendored `naklios.js` SDK posts with `targetOrigin: '*'` and the receive handler does not check `event.origin`. This is intrinsic to the cross-origin SDK pattern shared by every naklOS app — not a Books-introduced regression. Real-world impact: a malicious parent could speak the protocol, but the user's FSA folder handle lives in the parent (naklOS host), so the attacker would need to already have user grant. Not a meaningful escalation.

If the SDK ever adds origin-checking, Books inherits the improvement.

### Sidecar data
Per-book sidecar JSON contains user-derived fields (title, author, note, bookmarks). All stored in the user's nakliOS folder. No telemetry, no analytics, no external transmission. Note: the free-text `note` could contain personal reflections — same locality guarantee as the rest of the user's data.

### prompt() for bookmark labels
Uses native browser `prompt()`. Returns a string; stored as `bookmark.label`; rendered via `escapeHtml`. Safe.

### File-extension gating
`<input accept="...">` is a UI hint, not a guard. The actual gate is `engineKeyFor(filename)` which rejects anything not in `SUPPORTED_EXTS`. Mismatched extensions surface a `showReaderError` rather than reaching an engine.

### Vendored dependencies
- **foliate-js@1.0.1** — MIT, John Factotum. Recent (Apr 2025). No known CVEs. Vendored verbatim from the npm tarball.
- **pdfjs-dist@5.7.284** — Apache-2.0, Mozilla. Recent. Pdf.js has historic CVEs but is actively maintained; vendored subset is `build/pdf.min.mjs`, `build/pdf.worker.min.mjs`, `cmaps/`, `standard_fonts/`. Provenance recorded in [vendor/README.md](vendor/README.md).

Versions are pinned in path. Upgrades are explicit `mv vendor/<lib>@<old> vendor/<lib>@<new>` operations, not silent.

### Secrets / credentials
None in the repo. No API keys. No tokens. No `.env` files.

## Not in scope (already covered upstream)
- naklOS launcher-side trust model (postMessage handling, `embedUrl` sandbox attribute).
- foliate-js / pdf.js internals — both upstream maintained.

## Follow-ups
None blocking. Possible nice-to-haves for a later phase (no security urgency):
- ESC key to close the reader view.
- Origin check on SDK receive (would be a naklOS-wide change, not Books).
