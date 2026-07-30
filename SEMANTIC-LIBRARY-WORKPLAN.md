# Books — Private Semantic Library work plan

> **Lifecycle:** `active` — implementation sequence for v2+.
>
> **Implementation status (2026-07-30):** Phases 0–5 and the approved
> portability/recovery slice of Phase 7 are complete. Phase 6 illustrations
> remain on explicit product hold. Phase 8 formats and Phase 9 separate bets
> remain parked.
> This plan gathers the pending items
> from [DEFERRED.md](DEFERRED.md), the candidates in
> [CALIBRE-RESEARCH.md](CALIBRE-RESEARCH.md), and the requirements in
> [SEMANTIC-LIBRARY-SPEC.md](SEMANTIC-LIBRARY-SPEC.md). Inclusion here prevents
> work from being lost; it does not mean every item is approved.

## How to use this plan

Each phase has:

- A product or architecture question it resolves.
- Proposed deliverables.
- An exit gate that must pass before dependent work begins.

Do not start a later phase merely because it is interesting. Identity,
portable records, passage anchors, and migration safety are dependencies for
search, annotations, native reflow, and illustrations.

## Status vocabulary

- **Decision** — requires an explicit Adopt / Adapt / Reject choice.
- **Pending** — direction is accepted but implementation has not begun.
- **Parked** — retained with a trigger; not in the active release sequence.
- **Separate bet** — potentially valuable, but large enough to require its own
  spec and approval.
- **Rejected for core** — intentionally outside the semantic-library product.
- **Shipped** — already present in v1.4 and treated as a regression boundary.

## Release horizons

### Horizon A — Semantic foundation

Phases 0–2: lock scope, migrate to work-level identity, create portable
records, and build the local extraction/indexing pipeline.

### Horizon B — Library intelligence

Phases 3–4: expose work-centered organization, search, concepts, highlights,
and library-wide annotations.

### Horizon C — Native reading

Phases 5–6: add the Books-native reflow reader and optional source-grounded
illustrations.

### Horizon D — Continuity and breadth

Phases 7–9: strengthen export/recovery/sync, consider additional formats, and
make explicit decisions on the large Calibre-shaped product bets.

No calendar or version number is assigned until Phase 0 establishes the first
approved release slice.

---

## Phase 0 — Product boundary and architecture decisions

**Status:** Accepted. The binding choices and Calibre dispositions are in
[SEMANTIC-LIBRARY-DECISIONS.md](SEMANTIC-LIBRARY-DECISIONS.md).

**Question:** Which parts of a modern private semantic library are the first
product, and which Calibre-inspired capabilities are distraction?

### Work

1. Review [CALIBRE-RESEARCH.md](CALIBRE-RESEARCH.md) and classify each candidate
   family as **Adopt / Adapt / Reject**.
2. Confirm the product thesis and non-goals in
   [SEMANTIC-LIBRARY-SPEC.md](SEMANTIC-LIBRARY-SPEC.md).
3. Define the first end-to-end user outcome rather than approving isolated
   features.
4. Lock the minimum work/edition/asset identity rules.
5. Choose the canonical portable-record strategy:
   - Per-work JSON manifests.
   - Maintained catalog plus recoverable per-work records.
   - Another design that preserves rebuildability.
6. Lock the passage-anchor strategy for EPUB/Foliate, PDF, and Text.
7. Choose the local full-text indexing approach and expected storage budget.
8. Define deterministic extraction versus model-assisted extraction.
9. Define standalone and NakliOS AI consent boundaries.
10. Select a representative, legally usable regression corpus:
    - At least one file for every currently supported format.
    - A long EPUB with chapters and footnotes.
    - A born-digital PDF with a text layer.
    - A scanned PDF for explicit OCR behavior.
    - Narrative and expository works.
    - Multiple editions/formats of the same work.
    - Non-Latin and right-to-left text.
11. Decide whether metadata-provider enrichment belongs in the first release.
12. Choose measurable success criteria for import latency, reading readiness,
    extraction completeness, search quality, and migration safety.

### Deliverables

- Adopt / Adapt / Reject matrix for all Calibre feature families.
- Architecture decision records for identity, storage, indexing, anchors, and
  provider consent.
- Versioned draft schemas for work, edition, asset, passage, annotation,
  semantic record, derived artifact, and processing run.
- Approved first release slice and explicit exclusions.
- Regression corpus manifest and privacy-safe test fixtures.

### Exit gate

- No unresolved decision can force destructive schema changes in Phase 1.
- The first release has one coherent user outcome.
- Every approved AI capability has a non-AI degradation path.
- Migration and rollback requirements are written before code changes begin.

---

## Phase 1 — Work identity, catalog, migration, and basic safety

**Status:** Complete.

**Question:** Can Books represent a durable library without making a catalog
database the single point of failure?

### Work

1. Introduce versioned Work, Edition, and Asset records.
2. Retain filename-derived v1 `bookId` values as migration aliases.
3. Fingerprint assets without blocking initial reading.
4. Suggest exact duplicates and likely edition/work grouping; require user
   confirmation for ambiguous merges.
5. Implement portable per-work manifests.
6. Add a maintained, rebuildable catalog for fast library discovery.
7. Migrate existing:
   - Source filenames and formats.
   - Titles and authors.
   - Positions and `lastOpened`.
   - Bookmarks and free-text notes.
   - Reader preferences.
   - Cover-cache associations.
8. Keep v1.4 sidecars readable until post-migration validation succeeds.
9. Add idempotent schema migration, progress reporting, retry, and rollback.
10. Add essential work-details editing for user-owned metadata.
11. Group multiple source formats under one logical work.
12. Add library validation and catalog rebuild.
13. Define an initial portable export containing originals, manifests, and
    existing annotations.
14. Add reversible trash semantics for newly managed records if it can be done
    without destabilizing migration; otherwise route it to Phase 7.

### Tests

- Clean migration of empty, small, large, and orphan-containing v1 libraries.
- Interrupted migration resumes without duplicate works or lost sidecars.
- Rename and added-format flows preserve work identity.
- Catalog deletion followed by rebuild produces the same visible library.
- Browser, Folder, and Crate pass one shared contract suite.
- Source hashes before and after migration are identical.

### Exit gate

- Existing v1.4 libraries open with no data loss.
- The faithful reader does not depend on the new catalog being healthy.
- Work identity survives filename changes and additional formats.
- Export/re-import preserves original assets and user-authored records.

---

## Phase 2 — Local parsing, passages, indexing, and concepts

**Status:** Complete.

**Question:** Can every supported format produce source-grounded, local
structured understanding without delaying reading?

### Work

1. Add a persistent background job queue with per-stage status, cancellation
   where practical, retry, and resumable checkpoints.
2. Define a parser adapter that emits common document structure and source
   anchors from:
   - EPUB, MOBI, AZW3, and FB2 through Foliate.
   - PDF through its text layer and page geometry.
   - TXT, Markdown, HTML, and HTM through TextEngine-compatible parsers.
3. Segment normalized, format-neutral passages.
4. Store passage-to-source anchors and extraction version.
5. Build an offline lexical index over passage text, titles, metadata, and
   existing annotations.
6. Add a processing-status surface per work and per library.
7. Implement deterministic extraction for language, structure, named metadata,
   authored images, and candidate entities where reliable.
8. Define and implement the first concept/entity/scene schemas.
9. Add optional model-assisted extraction through capability interfaces.
10. Record evidence passages, run provenance, confidence, and user overrides.
11. Let users pause processing and remove derived semantic data.
12. Establish explicit scanned-PDF behavior:
    - Detect missing text layers.
    - Mark OCR as unavailable, approved, or separately queued.
    - Never pretend an image-only PDF was indexed successfully.
13. Measure storage separately for passages, lexical index, embeddings, and
    model outputs.
14. Decide whether the semantic index uses local embeddings in this phase or a
    later slice; lexical search cannot depend on that decision.

### Tests

- All supported formats emit navigable passages.
- Search results jump to the correct faithful-source location.
- Parser failure leaves the source readable.
- Extraction resumes after reload without restarting valid stages.
- Changing an extractor invalidates only affected derived records.
- No provider call occurs without destination-specific consent.
- Concept evidence always resolves to source passages.

### Exit gate

- Reading becomes available before background extraction finishes.
- Local full-text search works offline with cited passages.
- Concepts, entities, and scenes expose provenance and can be rebuilt.
- Derived-data deletion does not delete originals or user annotations.

---

## Phase 3 — Semantic library, metadata, organization, and discovery

**Status:** Complete.

**Question:** Can users navigate a large library by works, meaning, and reading
state without turning Books into a desktop database form?

### Work

**Implementation status (2026-07-30):** Work-centered rows, grouped formats,
portable work details, deterministic reading-state/rating/shelf/tag/annotation
views, portable saved queries, full-library lexical search, cited Ask,
reversible grouping, stable concept curation, and 60-work scale validation are
shipped.

1. Replace file-centered rows with work-centered library cards and details.
2. Show editions and available source formats without duplicating a work.
3. Add metadata facets approved in Phase 0, such as:
   - Author, series, language, publisher, publication date.
   - User tags, rating, reading state, and shelves.
   - Extracted entities, concepts, themes, places, and characters.
4. Add user-created shelves.
5. Add query-driven smart shelves/virtual libraries.
6. Add saved searches and structured filters.
7. Add full-library lexical search with excerpts and exact passage jumps.
8. Add semantic retrieval if Phase 2 approved and validated it.
9. Add work details for concepts, scenes, annotations, assets, and processing
   state.
10. Allow users to inspect, rename, hide, merge, split, or regenerate semantic
    records without editing source content.
11. Add reversible duplicate/work-grouping review.
12. Evaluate metadata/cover provider enrichment behind explicit network
    consent and attribution.
13. Add library-wide "Ask" only after retrieval citations and scope controls
    are reliable.
14. Preserve Continue Reading and the current fast open-book flow.

### Clarification: shelves versus storage libraries

Shelves are metadata views within the active library. Browser, Folder, and
Crate remain separate libraries. A shelf never silently spans, merges, or
copies storage backends.

### Tests

- A work with multiple formats appears once and opens the selected source.
- Smart shelves update deterministically from metadata/query changes.
- Hidden or renamed concepts remain stable across re-indexing.
- Search and Ask results cite and open exact passages.
- A library without embeddings retains full lexical browsing and search.

### Exit gate

- A 50+ work library remains understandable without filename knowledge.
- Users can distinguish authored metadata, user edits, and generated metadata.
- Search does not invent uncited library content.
- Backend isolation remains obvious in every library view.

---

## Phase 4 — Universal highlights and annotation memory

**Status:** Complete.

**Question:** Can one annotation model survive every reader engine and
extraction version?

### Work

1. Implement text selection and inline highlights for Foliate reflow.
2. Implement PDF text-layer selection and rectangle overlays.
3. Implement TextEngine selection and anchors.
4. Store portable selectors plus engine-specific fallbacks.
5. Support highlight color, note text, timestamps, and optional concept links.
6. Add per-book annotation navigation.
7. Add a library-wide annotations browser with search and filters.
8. Export annotations in a documented, human-readable format.
9. Re-anchor annotations after extraction upgrades.
10. Surface unresolved anchors for repair; never silently bind to merely
    similar text.
11. Decide whether the v1 free-text note remains a work note or migrates into
    the universal annotation model.
12. Keep bookmarks as a specialized annotation or a compatible adjacent type.

### Tests

- Highlights restore after reload across all engines.
- PDF overlays align after zoom and viewport changes.
- Annotation export contains resolvable source context.
- Extraction-version changes either re-anchor correctly or surface repair.
- User annotations survive deletion and regeneration of semantic indexes.

### Exit gate

- Every supported text-bearing engine has reliable selection and restoration.
- Library-wide annotation search is local and source-grounded.
- No annotation is lost or silently rebound during migration.

---

## Phase 5 — Books-native reflow reader

**Status:** Complete foundation. Advanced structures use a visible
faithful-mode fallback by design rather than disappearing from Native mode.

**Question:** Can Books present a consistent, accessible native reading
experience while preserving a faithful route to the authored source?

### Work

1. Build a renderer for the common structured document representation.
2. Support headings, paragraphs, lists, links, authored figures, captions,
   footnotes/endnotes, and chapter navigation.
3. Define explicit handling or faithful-mode fallback for:
   - Tables and wide preformatted content.
   - Mathematics and scientific notation.
   - Complex page layouts.
   - Fixed-layout EPUB.
   - Scanned PDF pages.
4. Add visible Faithful / Native mode switching.
5. Preserve and translate reading position between modes where possible.
6. Make every native passage link back to its faithful-source location.
7. Add deferred reader controls:
   - Font-family selection.
   - Justification.
   - Deeper spacing and format-specific layout controls.
8. Evaluate Calibre-inspired reader candidates:
   - Paged versus flow mode.
   - Stable reference locations.
   - Time remaining and richer headers/footers.
   - Dictionary lookup.
   - Read Aloud/TTS.
   - Auto-scroll and reading profiles.
   - Print/export of permitted representations.
9. Render universal annotations and concepts without obscuring source text.
10. Meet keyboard, touch, screen-reader, contrast, selection, and reduced
    motion requirements.

### Tests

- Native rendering preserves text order and source links.
- Unsupported structures visibly fall back instead of disappearing.
- Position and annotations remain stable across mode switches.
- Native mode works offline after its structured representation exists.
- Faithful mode remains behaviorally unchanged.

### Exit gate

- Users can read a representative EPUB and born-digital PDF in native mode
  without losing content or navigation.
- Every transformed passage has a faithful-source route.
- Accessibility review passes before illustration work begins.

---

## Phase 6 — Source-grounded illustrations and generated media

**Status:** Pending by explicit product decision. Phase 5 is complete, but the
generation-policy gate below has not been opened.

**Question:** Can generated media increase comprehension or delight without
misrepresenting the source, violating privacy, or destabilizing the reader?

### Decision gate

Before implementation, decide:

- Illustration styles and style consistency.
- Narrative scene-selection policy.
- Expository concept/mechanism-selection policy.
- Provider/model and on-device versus remote generation.
- Automatic, suggested, or on-demand generation.
- Cadence, regeneration, cancellation, and per-book controls.
- Storage quotas, cache eviction, export, and deletion.
- Character consistency and cross-scene state.
- Labeling, provenance presentation, safety, and copyright policy.

### Work

1. Rank candidate scenes or concepts using source evidence.
2. Let users inspect or edit the proposed subject before generation where
   appropriate.
3. Generate illustrations through the approved capability boundary.
4. Store prompts/configuration hashes, model/provider identity, evidence
   passage IDs, timestamps, and output history without storing credentials.
5. Insert derived images into native mode at source-grounded locations.
6. Clearly label generated media and provide a faithful/source context action.
7. Support hide, delete, regenerate, and choose-between-versions.
8. Keep illustration failures non-blocking.
9. Reuse the artifact pipeline for generated title cards where approved.
10. Evaluate later artifact types separately:
    - Diagrams and timelines.
    - Maps and relationship views.
    - TTS/audio.
    - Translation.
    - Study aids.

### Tests

- Network generation never begins without consent.
- Deleting illustrations leaves source, annotations, and semantic records
  intact.
- An illustration always resolves to its evidence passages and run record.
- Regeneration preserves prior provenance until the user removes it.
- Native reading remains usable with generation disabled or unavailable.

### Exit gate

- Generated media is optional, traceable, removable, and source-grounded.
- Story books illustrate selected key scenes rather than indiscriminate
  passages.
- Expository images are tied to explicit concepts or mechanisms.

---

## Phase 7 — Portability, recovery, storage control, and private continuity

**Status:** Complete contract and local recovery implementation. No sync
transport is enabled.

**Implementation status (2026-07-30):** Portable bundle import/export,
validation, catalog rebuild, recoverable Trash, per-class storage accounting,
derived cleanup, browser quota guidance, and the version/tombstone/conflict
contract are shipped or documented. No sync transport is enabled; transport
prototyping remains gated on an explicit product decision.

**Question:** Can the user move and recover a semantic library without needing
Books' current installation or a central service?

### Work

1. Finalize export/import bundles for originals, manifests, user metadata,
   reading state, annotations, and selected derived artifacts.
2. Document which indexes are omitted and rebuilt.
3. Add library validation, repair reports, and catalog/index rebuild.
4. Add reversible trash for works, assets, formats, annotations, and derived
   artifacts.
5. Add storage accounting by source, metadata, index, and generated media.
6. Add controls to clear/rebuild derived data without affecting portable data.
7. Define Browser storage quota and eviction guidance.
8. Define a synchronization record model with versioning and deletion
   tombstones.
9. Lock conflict behavior for:
   - Reading positions.
   - Independent bookmarks/highlights.
   - Concurrent note edits.
   - Metadata changes.
   - Deletes.
   - Generated artifacts.
10. Prototype private-mesh or another sovereign transport only after the
    record-level contract is stable.
11. Consider cross-device processing portability: reuse versus regenerate
    concepts, embeddings, and media.
12. Keep backend-to-backend copy or merge explicit and reviewable.

### Tests

- Full export into an empty backend reproduces the portable library.
- Unknown future fields survive round trips.
- Catalog/index corruption is repairable from portable records.
- Concurrent edits surface deterministic, recoverable outcomes.
- Crate export/sync never leaks plaintext through logs or transient records.

### Exit gate

- User-authored data is portable and recoverable.
- Sync conflict behavior is defined before any automatic synchronization.
- Generated caches can be discarded without breaking the library.

---

## Phase 8 — Additional formats and extraction breadth

**Status:** Parked behind semantic-core stability.

### CBZ and CBR

Retain the locked extractor choices from [DEFERRED.md](DEFERRED.md):

- CBZ through `fflate`.
- CBR through `node-unrar-js`.
- One extractor interface and one image-paginated comic renderer.
- No server upload, telemetry, split-volume RAR, or RAR creation.

Comic support requires its own position model, reader controls, semantic/OCR
policy, and test corpus. It should not be smuggled into the native text reader.

### Scanned PDFs and OCR

Semantic indexing creates stronger pressure for OCR than v1 reading did.
Evaluate local OCR cost, languages, page anchoring, confidence, storage, and
whether OCR belongs in Books or an external preprocessing tool.

The first candidate is Baidu PaddleOCR. Compare its official browser SDK,
self-hosted local pipeline, and optional hosted API. Do not treat a hosted
quota as unlimited: the preferred “unlimited” route is local inference under
the user's own compute and storage budget. Any remote route requires explicit
page-image transmission consent.

The evaluation must include structured page output, reading order, tables,
formulas, coordinates, multilingual books, cancellation/resume, runtime and
model size, licensing, provenance, and removable/rebuildable OCR artifacts.

### DjVu

Remain parked until meaningful demand or a materially lighter browser library.
The documented workaround remains conversion to PDF.

### Legacy AZW

Rejected for core unless demand changes substantially. Continue recommending
conversion through Calibre or another dedicated tool.

### Exit gate

Each added format has a dedicated reader/extraction contract and cannot regress
the existing formats or inflate the default bundle without an explicit
decision.

---

## Phase 9 — Explicit decisions on large Calibre-shaped bets

**Status:** Decision / separate bets.

These capabilities are not implicit semantic-library scope:

### Format conversion and polishing

**Provisional disposition:** Separate bet. A browser conversion service needs
its own format matrix, WASM/runtime budget, licensing review, output validation,
and non-destructive workflow.

### E-book source editing and comparison

**Provisional disposition:** Rejected for core. Editing authored EPUB/Kindle
internals is a specialist product and conflicts with the immutable-source
principle unless isolated as an explicit copy/edit workflow.

### Dedicated e-reader hardware management

**Provisional disposition:** Rejected for the web app. USB/MTP device drivers,
storage cards, and device-specific transfer belong to native tools or a
separate bridge.

### Content server and cross-device web access

**Provisional disposition:** Adapt only after Phase 7. The relevant user value
is private continuity, not reproducing Calibre's long-running desktop server.

### News/RSS acquisition

**Provisional disposition:** Separate reading-inbox product question.

### Plugin marketplace

**Provisional disposition:** Rejected for the first semantic-library releases.
Evaluate small permissioned capability interfaces before third-party code
execution.

### CLI and automation

**Provisional disposition:** Adapt later. Portable schemas and capability
contracts may support automation without shipping Calibre's desktop command
surface.

### Exit gate

Each accepted large bet receives a separate spec, threat model, and work plan.

---

## Cross-cutting workstreams

### Security and privacy

- Treat book, archive, HTML, image, font, metadata, and model output as
  untrusted input.
- Review every provider boundary and consent surface.
- Enforce processing limits and decompression safeguards.
- Verify Crate isolation and absence of telemetry.
- Red-team prompt injection from book text before library-wide Ask.

### Accessibility

- Keyboard and touch parity.
- Screen-reader structure and announcements.
- Visible focus, high contrast, reduced motion, and scalable text.
- Selection and annotation behavior that does not depend on pointer precision.
- Native-reader semantics before generated-media polish.

### Performance and storage

- Reading-first scheduling.
- Incremental parsing and indexing off the main interaction path.
- Storage budgets and cleanup controls.
- Corpus-based benchmarks for large books and large libraries.
- Avoid loading format libraries or models until required.

### Test architecture

- Contract tests shared across Browser, Folder, and Crate.
- Fixture corpus with known passages, anchors, concepts, scenes, and expected
  search results.
- Migration, interruption, corruption, quota, and rollback tests.
- Golden native-render snapshots for structural fidelity.
- Provider fakes; tests must not require live paid inference.

### Documentation and operations

- Version every portable schema.
- Keep migration and rollback notes with each release.
- Document data locations, derived-versus-portable status, and export behavior.
- Record benchmark results and model/extractor versions.

## Complete mapping of existing deferred items

| Existing item | Source | Plan location | Current disposition |
|---|---|---|---|
| Concept extraction on import | `DEFERRED.md` | Phase 2 | Shipped |
| AI-illustrated native reader | `DEFERRED.md` | Phases 5–6 | Native foundation shipped; generation pending decision |
| Generated title-card covers | `DEFERRED.md` | Phase 6 artifact pipeline | Pending decision |
| Font family, justification, deeper reader controls | `DEFERRED.md` | Phase 5 | Font/justification shipped; deeper controls parked |
| Inline highlights with notes | `DEFERRED.md` | Phase 4 | Shipped |
| Search across library | `DEFERRED.md` | Phases 2–3 | Shipped |
| PDF text-layer highlight overlays | `DEFERRED.md` | Phase 4 | Shipped |
| Scanned-PDF OCR / PaddleOCR evaluation | `DEFERRED.md` | Phase 8 | Pending evaluation |
| CBZ + CBR support | `DEFERRED.md` | Phase 8 | Parked |
| DjVu support | `DEFERRED.md` | Phase 8 | Parked |
| Legacy AZW support | `DEFERRED.md` | Phase 8 | Rejected for core |
| Multiple libraries / shelves | `DEFERRED.md` | Phase 3 shelves; Phase 7 backend movement | Shelves shipped; backend movement parked |
| Cross-device conflict resolution | `DEFERRED.md` | Phase 7 | Contract shipped; transport pending decision |
| Library index format migration | `DEFERRED.md` | Phase 1 | Shipped |

## Mapping of Calibre comparison candidates

| Calibre capability family | Plan location | Provisional disposition |
|---|---|---|
| Work-level library records and multiple formats | Phases 0–1 | Adapt |
| Rich metadata and optional provider enrichment | Phases 1 and 3 | Adapt / decision |
| Shelves, saved searches, virtual libraries | Phase 3 | Adapt |
| Full-library full-text search | Phases 2–3 | Adopt |
| Inline and library-wide annotations | Phase 4 | Adopt with portable anchors |
| Reader depth, TTS, dictionaries, profiles | Phase 5 | Adapt per feature |
| Export, backup, repair, reversible trash | Phases 1 and 7 | Adopt |
| Conversion and polishing | Phase 9 | Separate bet |
| E-book source editor and comparison | Phase 9 | Rejected for core |
| Hardware-device management | Phase 9 | Rejected for web app |
| Content server and position sync | Phase 7 / Phase 9 | Adapt to private continuity |
| News/RSS acquisition | Phase 9 | Separate bet |
| Plugin marketplace | Phase 9 | Rejected for initial releases |
| CLI and automation | Phase 9 | Adapt later |
| AI discussion and recommendations | Phases 2–3 | Adapt with citations and consent |

## Next decision agenda

The approved foundation is built and release-tested. Future work must begin by
opening one of the remaining gates rather than silently expanding scope:

1. Run the gated scanned-PDF OCR evaluation, with PaddleOCR as the first
   candidate.
2. Decide whether to design source-grounded illustration generation (Phase 6).
3. Decide whether embeddings add enough value beyond lexical retrieval to
   justify their storage and privacy model.
4. Decide whether any metadata provider meets the licensing, attribution,
   caching, and consent bar.
5. Decide whether to select a sovereign sync transport for the documented
   record/conflict contract.
6. Re-rank the parked Phase 8 formats and Phase 9 Calibre-shaped separate bets.

The standing product test remains:

> Does this capability strengthen a private semantic library, or merely
> reproduce a Calibre-shaped surface?
