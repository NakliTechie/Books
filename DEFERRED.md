# books — Deferred to v2+

> **Lifecycle:** `living` — running list of features and design decisions intentionally pushed past v1. Update as decisions land. The point of this doc is to make sure things we knowingly deferred are not lost — they're parked, not forgotten.

## Convention

When deferring something during a walkthrough or implementation, **add an entry here** before closing the discussion. An entry has:

1. A clear name (the thing being deferred)
2. What it would do
3. Why it's deferred for v1
4. The trigger that says "now is the time to revisit"

Without the trigger, the deferral is just an open question.

---

## Content / UX layers

### Cover thumbnails

Show extracted cover art (from ePub `<package>/Cover.jpg` or PDF page 1 render) in the library view instead of (or alongside) text-only filenames.

**Why deferred:** Cover extraction is per-format work (epub.js can pull a cover blob; PDF needs rendering page 1 to canvas, encoding, caching). The library list works fine as text in v1.

**Trigger to revisit:** When 3+ users say "this looks like a directory listing, not a library." Or when the library view feels visually empty enough to hurt usability.

### Reader prefs panel

User-controllable typography for the reader: font face, font size, line height, page margins, justification, dark/sepia color profiles independent of nakliOS theme.

**Why deferred:** Reader prefs are a deep UX surface (multi-line settings panel, persistence per-book vs global, sane defaults that work for both formats). v1 ships with one good set of defaults.

**Trigger to revisit:** When 3+ users ask for it, or when a font/size choice in v1 turns out to be wrong for a meaningful fraction of books.

### Inline highlights with notes

Select text in the reader → highlight + optional note text. Highlights persist with stable position info (CFI for ePub, page+rect for PDF) and re-render on reopen.

**Why deferred:** Substantial UX scope — text selection coordination in epub.js iframe, PDF text-layer interaction, overlay rendering on reflow, sidebar of all highlights for a book. Would roughly double the build effort.

**Trigger to revisit:** After v1 ships and is in regular use; or when "I can't highlight" is the top friction point.

### Search across library

Full-text search across all books in the library (or all *notes*, depending on scope).

**Why deferred:** Indexing requires extracting and storing text, which is significant work for a feature most series-style users would shrug at. Notes-only search is a smaller surface but still v1.5.

**Trigger to revisit:** Once library hits ~50+ books (volume makes search valuable) or once notes count makes "where did I write that?" a real question.

### Cross-engine search (within the open book)

Search within the currently-open book — find a phrase, jump to occurrences with highlight overlays.

**Why deferred:** The three engines need three different implementations. foliate-js has `view.search()` (returns CFI matches). pdf.js has a separate `findController` with a canvas-overlay highlight layer. TextEngine would need a custom substring index. Wiring all three behind one search UI is real engineering — call it 2–3 sessions of work.

**Trigger to revisit:** v1 stable in real use; OR when a user opens a long book and wishes they could grep.

### CBZ + CBR (comic-book archives) support

Read comics packaged as ZIP (CBZ) or RAR (CBR) archives. Both are deferred to the same release because they share a renderer.

**Why deferred:** Image-paginated reader UX is materially different from text-reflow (different controls, different position model — page index instead of CFI/percent, different empty-state copy). Adding it to v1 would meaningfully widen UX scope. Both decoders exist and are mature; the bottleneck is the comic-mode reader UI, not parsing.

**Library choices** (locked-in advance for v1.1):
- **CBZ → [`fflate`](https://github.com/101arrowz/fflate)** — fast, tiny, MIT, sync+async+streaming. Don't add JSZip; reuse fflate if already present elsewhere.
- **CBR → [`node-unrar-js`](https://github.com/YuJianrong/node-unrar-js)** — despite the name, runs in browser. Official UnRAR source compiled to WASM via Emscripten (not a clean-room reimplementation), so it has full format fidelity for RAR v4 and v5, unicode filenames, password-protected entries. UnRAR license permits extraction. WASM binary must be loaded explicitly and passed via `wasmBinary` to `createExtractorFromData`. API: `getFileList()` for headers, `extract({files: [...]})` returning lazy iterators of `Uint8Array` per entry.
- **Limitations to accept**: no volume-split RAR support (`.r01`, `.r02`, etc.) — surface a clear error to the user. No RAR creation (proprietary; we don't need it).
- **Rejected for this app**: `libarchive.js`, `archive-wasm`, `libarchive-wasm`. They bundle libarchive's full format zoo (7z, TAR, ISO, etc.) — wasteful for two formats. Reserve for a future general-purpose archive tool.

**Internal interface (v1.1 design ahead-of-time)**: both formats sit behind one internal extractor interface — `open → list entries → extract entry as Blob`. Two backends, one consumer (the page renderer). The renderer doesn't know which format the source was.

**Hard rules**: no server upload (both libs run fully in-browser), no telemetry (verify before shipping), bytes stay in memory or FSA-granted folders, errors surface clearly (corrupt archive, password-protected without password, split-volume RAR).

**Trigger to revisit:** v1 stable + Phase 1.1 starts; OR a user requests comic support strongly enough to justify the second UI mode.

### DjVu support

Read scanned-book DjVu files (common in technical/academic archives).

**Why deferred:** djvu.js exists but is a heavyweight WASM library; niche audience; would inflate bundle size significantly for a feature few would use. Document the workaround: convert DjVu → PDF (most readers can do this).

**Trigger to revisit:** A meaningful audience requests it, OR a much lighter DjVu library becomes available.

### Legacy AZW (pre-AZW3) support

Read old Kindle AZW files (pre-KF8 format).

**Why deferred:** foliate-js doesn't handle pre-KF8 AZW. Format is effectively obsolete (KF8/AZW3 superseded it in 2011). Users with old AZW files can convert via Calibre.

**Trigger to revisit:** Improbable. Documented for completeness.

### Multiple libraries / shelves

Multiple `library/` subdirs (e.g. `library/personal/`, `library/work/`) with shelf-switching UI.

**Why deferred:** One flat library is enough for v1. The folder-based mental model already accommodates this if users want it via Finder (drop books in subfolders) — we just won't render the hierarchy in v1.

**Trigger to revisit:** When users start creating subfolders themselves; or when the library exceeds the size where one flat view is comfortable.

---

## Data model

### Standalone-mode persistence (Tijori pattern)

Self-pickered FSA + IndexedDB for the dir handle, so Books can persist position and notes when run outside nakliOS at `naklitechie.github.io/Books/`.

**Why deferred:** If standalone is preview-only (per walkthrough Q1's recommended lock), this is unnecessary. Adds dual code path.

**Trigger to revisit:** If walkthrough Q1 flips to "preview-only is insufficient — Books must work fully standalone."

### Cross-device sync conflict resolution

Two devices write to the same `notes/<book-id>.json` with different positions → reconciliation logic (last-write-wins? merge bookmarks? show both?).

**Why deferred:** File-system semantics handle this trivially for any one user with one open reader at a time. If the user reads on two devices simultaneously and both write, last writer wins via the underlying sync engine.

**Trigger to revisit:** When Books is wired onto private-mesh (the sovereign data fabric at `naklios-universe/private-mesh-universe/`), and Vault sync needs explicit conflict handling.

---

## Operations

### Library index format migration

If we ship v1 with scan-on-load and later add a maintained index, we'll need a one-time scan to seed the index.

**Why deferred:** Only matters if we move past walkthrough Q3's option A.

**Trigger to revisit:** When Q3 is reopened (see Q3's tripwire).
