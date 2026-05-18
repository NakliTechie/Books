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
