# books — Deferred to v2+

> **Lifecycle:** `living` — running list of features and design decisions intentionally pushed past v1. Update as decisions land. The point of this doc is to make sure things we knowingly deferred are not lost — they're parked, not forgotten.
>
> The complete execution mapping for these items now lives in
> [SEMANTIC-LIBRARY-WORKPLAN.md](SEMANTIC-LIBRARY-WORKPLAN.md). This file
> remains the source of deferral history, rationale, and revisit triggers.

## Convention

When deferring something during a walkthrough or implementation, **add an entry here** before closing the discussion. An entry has:

1. A clear name (the thing being deferred)
2. What it would do
3. Why it's deferred for v1
4. The trigger that says "now is the time to revisit"

Without the trigger, the deferral is just an open question.

---

## Current future queue — 2026-07-30

This is the consolidated queue, not a committed release roadmap:

| Capability | State | Revisit gate |
|---|---|---|
| Scanned-PDF OCR, with Baidu PaddleOCR as the first candidate | Pending evaluation | Complete the OCR privacy, runtime, quality, anchoring, and licensing spike below |
| Source-grounded AI illustrations | Pending product decision | Approve the Phase 6 generation policy |
| Local embeddings / semantic-similarity index | Pending product decision | Demonstrate material value beyond lexical retrieval and define storage/privacy |
| Metadata and cover provider | Pending policy decision | Approve licensing, attribution, caching, and destination consent |
| Sovereign sync transport and mobile continuity | Pending product decision | Select a transport for the shipped version/tombstone/conflict contract |
| Standalone folder libraries with durable sidecar metadata | Pending architecture and performance spike | Approve the folder layout, reconciliation rules, permission recovery, and large-library benchmarks |
| TTS, dictionaries, reading profiles, and deeper reader controls | Pending per-feature evaluation | Rank against observed reader demand and accessibility impact |
| Generated title cards and other derived media | Pending product decision | Open the Phase 6 artifact pipeline |
| CBZ/CBR and DjVu | Parked | Approve dedicated reader/extractor contracts and representative corpora |
| Multiple physical libraries and backend movement | Parked | Approve explicit cross-backend movement semantics |
| Conversion, polishing, news acquisition, CLI automation, and other Calibre-shaped bets | Separate bets | Reassess independently; none belongs in core by default |

### Scanned-PDF OCR — evaluate Baidu PaddleOCR

**Status:** Pending evaluation. Do not integrate it into the current release.

PaddleOCR is the first candidate because it can run locally, is Apache-2.0,
supports multilingual recognition and structured document parsing, and now has
an official browser inference SDK. Treat “unlimited” as a property of
self-hosted/local inference under the user's own compute budget—not as an
assumption about any hosted API quota.

Evaluate three capability routes:

1. In-browser inference through PaddleOCR.js where the model/runtime size and
   browser memory budget are acceptable.
2. A visible local PaddleOCR service through the same local-provider boundary
   used by Books AI.
3. The hosted PaddleOCR API only as an optional, explicitly consented remote
   destination. Page images must never be transmitted silently.

The spike must measure:

- Born-scanned, skewed, low-contrast, multilingual, vertical, and mixed-script
  book pages.
- Text order, headings, tables, formulas, footnotes, figures, and page
  coordinates—not merely raw character accuracy.
- Apple Silicon and ordinary CPU latency, memory, model-download size, battery
  impact, cancellation, and resumability.
- Browser, Folder, and Crate storage consumption.
- Model, weight, browser-SDK, and commercial-use licensing.
- Confidence reporting and the UI for “unavailable”, “queued”, “partial”, and
  “needs review”.

If adopted, OCR output is versioned derived data with page/region anchors,
confidence, model provenance, and a visible route to the scanned source page.
It must be removable and rebuildable without changing the PDF, annotations, or
portable records.

**Trigger to revisit:** A dedicated OCR spike is scheduled with a
representative scanned-book corpus and local/BYOK runtime budget.

---

## Content / UX layers

### Local concept metadata + AI-illustrated native reader

**Status:** Split delivery. Local concept metadata and the Books-native reader
shipped in the semantic-library foundation. AI-generated illustrations remain
pending by explicit product decision and must not be implemented until the
Phase 6 gate is opened.

This is intentionally split into two stages:

1. **Shipped — concept extraction on import.** Every newly added book is parsed for its
   key concepts. The resulting structured metadata is stored locally on the
   user's machine alongside that book's other Books metadata. The eventual
   schema should support both expository concepts and narrative elements such
   as characters, settings, events, and key scenes.
2. **Shipped — native reader foundation.** Books reflows extracted passages,
   exposes curated concepts, preserves faithful-source navigation, and visibly
   falls back for unsupported structures.
3. **Pending — illustrated native reader.** Insert separately generated,
   source-grounded illustrations at meaningful points. For story books, the
   initial interpretation remains selected key scenes rather than every
   concept.

**Decisions deliberately left open:** illustration style and consistency,
model/provider, on-device versus hosted generation, user controls and
regeneration, image caching/storage, placement cadence, and safety/copyright
policy. Faithful/Native coexistence and semantic metadata versioning are now
established.

**Why the remaining stage is deferred:** Image generation needs its own product
and safety policy even though the extraction schema and native layout
foundation now exist.

**Trigger to revisit:** An explicit design pass approves the illustration
generation policy in Phase 6.

### Cover thumbnails — shipped in v1.2

Delivered: Foliate package covers and PDF page-one thumbnails are resized,
cached under the active Books namespace, and rendered with a typographic
fallback. Cache identity remains backend-local.

**Still deferred:** generated title cards persisted as images for formats that
have no authored cover. The current CSS fallback is deliberately sufficient.

### Reader prefs panel — shipped in v1.1

Delivered: font size, line height, text width, and system/paper/sepia/night profiles for reflowable books and plain text. Global defaults are local UI preferences; hosted books can carry a per-book override. PDF layout remains unchanged.

**Shipped in the semantic-library reader:** font-family selection and
justification.

**Still deferred:** deeper format-specific layout controls beyond the current
Faithful/Native fallback contract.

### Inline highlights with notes

**Status:** Shipped in the semantic-library foundation.

Selections produce portable highlights with optional notes, engine fallbacks,
restoration, per-work navigation, a library-wide annotation browser, and
human-readable export.

### Search across library

**Status:** Shipped in the semantic-library foundation.

Books builds a local, rebuildable lexical index over passages and supports
source-grounded full-library search. A 60-work regression harness covers
facets and title discovery without embeddings.

### Cross-engine search (within the open book) — shipped in v1.2

Delivered: one Find surface searches Foliate books, PDF page text, and the
Text engine, cycles through matches, shows excerpts, and jumps through the
engine adapter. Foliate retains its native CFI highlights.

**Shipped in the semantic-library foundation:** PDF text-layer selection and
highlight overlays.

### CBZ + CBR (comic-book archives) support

Read comics packaged as ZIP (CBZ) or RAR (CBR) archives. Both are deferred to the same release because they share a renderer.

**Why deferred:** Image-paginated reader UX is materially different from text-reflow (different controls, different position model — page index instead of CFI/percent, different empty-state copy). Adding it to v1 would meaningfully widen UX scope. Both decoders exist and are mature; the bottleneck is the comic-mode reader UI, not parsing.

**Library choices** (locked for the future comic-reader phase):
- **CBZ → [`fflate`](https://github.com/101arrowz/fflate)** — fast, tiny, MIT, sync+async+streaming. Don't add JSZip; reuse fflate if already present elsewhere.
- **CBR → [`node-unrar-js`](https://github.com/YuJianrong/node-unrar-js)** — despite the name, runs in browser. Official UnRAR source compiled to WASM via Emscripten (not a clean-room reimplementation), so it has full format fidelity for RAR v4 and v5, unicode filenames, password-protected entries. UnRAR license permits extraction. WASM binary must be loaded explicitly and passed via `wasmBinary` to `createExtractorFromData`. API: `getFileList()` for headers, `extract({files: [...]})` returning lazy iterators of `Uint8Array` per entry.
- **Limitations to accept**: no volume-split RAR support (`.r01`, `.r02`, etc.) — surface a clear error to the user. No RAR creation (proprietary; we don't need it).
- **Rejected for this app**: `libarchive.js`, `archive-wasm`, `libarchive-wasm`. They bundle libarchive's full format zoo (7z, TAR, ISO, etc.) — wasteful for two formats. Reserve for a future general-purpose archive tool.

**Internal interface**: both formats sit behind one internal extractor interface — `open → list entries → extract entry as Blob`. Two backends, one consumer (the page renderer). The renderer doesn't know which format the source was.

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

### Multiple storage libraries / shelves

**Split delivery:** User-created shelves and smart views shipped as portable
metadata. Browser, Folder, and Crate intentionally remain isolated storage
libraries.

**Still deferred:** A UI for multiple physical `library/` roots or moving works
between backends.

**Trigger to revisit:** Private continuity or explicit cross-backend movement
is approved.

---

## Data model

### Standalone-mode persistence — shipped in v1.4

Books now uses an origin-scoped IndexedDB virtual filesystem when run outside
NakliOS at `books.naklitechie.com`. It persists the complete library, positions,
bookmarks, notes, and cached covers without requiring a directory permission.

The earlier FSA-handle proposal was not used: IndexedDB gives the standalone
site a permission-free library while the shared `naklios.fs` surface keeps the
reader code identical across Browser, Folder, and Crate backends.

### Standalone folder libraries and durable sidecars

**Status:** Pending. IndexedDB remains the shipped, permission-free Browser
backend; this work adds an optional folder-backed standalone library rather
than replacing it.

The user can choose **Add folder** and grant Books access to an existing
collection. Books reconciles supported files in that folder, reads sources in
place instead of copying them into IndexedDB, and writes canonical portable
metadata into a Books-owned sidecar directory inside the selected folder.
That folder metadata includes work/edition manifests, reading state,
annotations, user edits, curation, and sync/tombstone records. Search indexes,
thumbnails, embeddings, and other reproducible caches remain explicitly
derived and may be kept locally or in a separate cache subtree.
Because the library remains an ordinary directory, the user's existing
backup, NAS, cloud-drive, or peer-sync tool can carry sources and portable
sidecars together. Books does not silently choose that transport; it
reconciles externally arrived changes through the version/conflict contract.

The directory handle may be remembered in IndexedDB as a reconnect
convenience, but IndexedDB must not be the only copy of canonical metadata.
Losing browser site data should not erase the library's reading history or
user-authored records when the source folder still exists.

Folder reconciliation must be incremental and reviewable:

- Inventory paths, sizes, and modification times first; fingerprint only new
  or changed candidates.
- Checkpoint long scans, run them away from the main interaction path, and
  expose progress, pause, cancel, and manual rescan controls.
- Reconcile additions and changes automatically while connected. A missing
  file or lost permission is not an immediate destructive delete; removals
  enter a reviewable/tombstoned state.
- Support recursive scanning with explicit exclusions and never traverse or
  write outside the granted root.
- Keep source files immutable. Books writes only to its documented sidecar
  area unless the user explicitly requests a file operation.
- Virtualize large library views and benchmark cold scan, warm rescan, change
  detection, memory, and recovery on collections large enough to expose
  browser limits.

Open architecture questions include the sidecar directory name and schema,
atomic/journaled writes across browser implementations, case and path
normalization, rename detection, external metadata edits, multiple folder
roots, permission re-grant UX, and whether optional derived data belongs in
the folder. The spike must also test conflicts and partial updates caused by
external folder-sync tools.

**Trigger to revisit:** Run the Phase 7A spike with representative 1k, 10k,
and stress-scale collections, then approve the portable directory contract
and reconciliation behavior.

### Cross-device sync conflict resolution

**Status:** Record/version/tombstone and conflict behavior are documented in
`SYNC-CONTRACT.md`; no transport is enabled.

**Why transport is deferred:** Books does not silently select or activate a
central synchronization service.

**Trigger to revisit:** An explicit product decision selects private-mesh or
another sovereign transport.

---

## Operations

### Library index format migration

**Status:** Shipped. Books maintains a rebuildable catalog and versioned local
semantic records, migrates legacy aliases/sidecars idempotently, and can
validate or rebuild without changing original bytes.
