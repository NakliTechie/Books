# Books — Private Semantic Library extension spec

> **Lifecycle:** `active` — v2+ product and architecture direction.
>
> **Implementation status (2026-07-30):** The approved semantic-library
> foundation is complete. Accepted architectural choices are recorded in
> [SEMANTIC-LIBRARY-DECISIONS.md](SEMANTIC-LIBRARY-DECISIONS.md). This document
> extends the shipped v1.4 reader contract in [SPEC.md](SPEC.md). Sequencing
> and gates live in
> [SEMANTIC-LIBRARY-WORKPLAN.md](SEMANTIC-LIBRARY-WORKPLAN.md).

## Thesis

> The modern take is not “Calibre in a browser.” It is a **private semantic
> library**: the user owns the files, but the library actively helps them
> understand, read, connect, and remember what is inside.

Calibre's enduring virtues are ownership, portability, offline operation, and
format independence. Books should preserve those virtues without reproducing
Calibre's desktop file-manager interface, conversion cockpit, hardware-driver
surface, or plugin sprawl.

Books becomes the reading and understanding layer for a private personal
library. It remains useful without AI, without an account, and without a
network connection.

## Relationship to Books v1.4

The existing product remains the base:

- The faithful Foliate, PDF, and Text readers continue to work.
- Browser, Folder, and Crate remain distinct storage backends.
- Standalone operation remains permission-free through IndexedDB.
- A future optional standalone folder backend may read an existing collection
  in place and keep canonical portable sidecars inside that folder; IndexedDB
  remains available for users who do not grant directory access.
- NakliOS hosting continues through the cross-origin SDK contract.
- Existing source files, positions, bookmarks, notes, covers, and preferences
  remain valid during migration.

The extension adds a durable library model and rebuildable intelligence above
those source files. It must not require users to discard or re-import an
existing Books library.

## Product definition

A private semantic library has five layers:

1. **Own** — preserve original files and portable user-authored metadata.
2. **Understand** — parse structure, text, entities, concepts, and scenes.
3. **Read** — offer faithful and Books-native reading modes.
4. **Recall and connect** — unify search, annotations, concepts, and questions.
5. **Move** — export, restore, and eventually synchronize without surrendering
   control of the library.

## Goals

### G1. Durable work-level library identity

A logical work can contain one or more editions and source formats. Identity
must survive filename changes, added formats, metadata corrections, and index
rebuilds.

### G2. Local, resumable understanding on import

Every imported book enters a background pipeline that can extract:

- Bibliographic metadata and document structure.
- Format-neutral text passages with stable source anchors.
- Full-text search material.
- Concepts, themes, people, places, events, and relationships.
- Narrative elements such as characters, settings, and key scenes.

Deterministic parsing happens first. Model-assisted enrichment is optional,
versioned, and subject to the AI privacy boundary.

### G3. Source-grounded retrieval

Search results, concept pages, summaries, and AI answers must point back to
specific passages in the source. A generated claim without a recoverable
source anchor is not canonical library knowledge.

### G4. Two complementary reading modes

- **Faithful mode** presents the authored EPUB, PDF, or text layout using the
  existing engines.
- **Native mode** presents a sanitized, format-neutral, reflowed representation
  designed for accessibility and Books features.

Users can always return to faithful mode. Native mode does not overwrite or
modify the source book.

### G5. Universal annotations

Highlights, notes, bookmarks, and reading positions use a format-independent
annotation model with engine-specific fallback anchors. They remain navigable
from faithful mode, native mode, search, and library-wide views.

### G6. Derived media without source mutation

Illustrations, generated title cards, summaries, audio, translations, and
other transformations are derived artifacts. They are stored separately,
carry provenance, and can be deleted or regenerated without touching the
original book or user-authored notes.

### G7. Same product across storage backends

The catalog, extraction state, search index, annotations, and derived artifacts
obey the same logical contracts in Browser, Folder, and Crate. Switching
backends continues to switch libraries; it never silently merges or copies
them.

### G8. Portable and recoverable

User-authored metadata and annotations are portable and versioned. Search
indexes, thumbnails, embeddings, and model outputs are rebuildable. A damaged
or deleted derived index must not destroy the library.

## Non-goals

The semantic-library extension does not initially attempt to:

- Rebuild Calibre's general-purpose conversion suite or e-book source editor.
- Circumvent DRM or claim support for protected source files.
- Implement USB/MTP drivers or manage dedicated e-reader hardware.
- Require a central Books account, hosted library database, or always-on
  server.
- Mutate authored source files in place.
- Automatically upload book contents to an AI or metadata provider.
- Establish a broad third-party plugin marketplace.
- Make every Calibre feature part of the Books roadmap.

Those areas may be evaluated as separate product bets, integrations, or
explicit rejections in the work plan.

## Product principles

### P1. Originals are immutable

Books never modifies the imported source asset. Corrections, reading state,
annotations, concepts, and generated media live in separate records.

### P2. User-authored data outranks generated data

User edits and annotations are canonical. Extracted or model-generated fields
are suggestions with provenance and confidence, never silent replacements.

### P3. Local first means useful offline

Import, faithful reading, existing annotations, deterministic metadata,
lexical search, and library browsing must work without the network. Optional
model-backed features may degrade when no approved inference route exists.

### P4. No invisible content transmission

No passage, metadata field, annotation, or image leaves the current device
unless the user has approved that provider and destination. NakliOS AI
continues to use host-mediated consent. The built-in Gemma sidecar is
on-device and user-started; standalone remote providers use the shipped,
destination-specific consent design.

### P5. Intelligence is traceable and disposable

Every generated record identifies its input anchors, extractor/model version,
creation time, and configuration. Generated records can be invalidated and
rebuilt after parser, schema, or model changes.

### P6. Progressive enhancement

A parse, indexing, embedding, or generation failure never prevents the
original book from being read. Every background job is observable, resumable,
cancellable where practical, and safe to retry.

### P7. One semantic core, multiple renderers

The format parsers produce a common structured representation. Faithful,
native, search, annotation, concept, and illustration surfaces consume that
representation through stable interfaces rather than format-specific
shortcuts.

### P8. Private does not mean trapped

The user can export source files, manifests, annotations, and selected derived
artifacts in documented formats. Books-specific intelligence should not make
the source library less portable.

## Domain model

### Library

One isolated collection attached to one active storage backend. A Browser,
Folder, or Crate library has its own catalog and derived artifacts.

### Work

The user's logical notion of a book, independent of a particular file or
edition. A work owns user-facing metadata, organization, annotations, and
relationships.

### Edition

A published or imported expression of a work: language, publisher, publication
date, ISBN/identifier, revision, and related metadata.

### Asset

An immutable source file such as EPUB, PDF, MOBI, AZW3, FB2, TXT, Markdown, or
HTML. Multiple assets can represent one edition or work.

### Passage

A format-neutral addressable unit of text. It contains normalized text,
structural context, and one or more anchors back to the source engine.

### Entity

A named person, character, place, organization, object, or other addressable
thing mentioned by passages.

### Concept

An idea, topic, theme, claim, motif, or subject derived from one or more
passages. Concepts can relate to entities and other concepts.

### Scene

A narrative interval with participants, setting, events, passage boundaries,
and optional significance. Scenes are relevant to fiction and narrative
non-fiction; expository books need not produce them.

### Annotation

A user-authored bookmark, highlight, note, or link whose target is represented
by a portable selector and engine-specific fallbacks.

### Derived artifact

A rebuildable thumbnail, generated cover, summary, embedding, illustration,
audio segment, translation, OCR result, or other machine-produced output.

### Processing run

The provenance record for parsing, extraction, indexing, or generation. It
links inputs, tool/model identity, schema version, configuration, status,
errors, and outputs.

## Identity model

Filename-derived `bookId` remains a legacy alias during migration, not the
future canonical identity.

Implemented identity rules:

- `workId` — locally generated stable UUID.
- `editionId` — locally generated stable UUID within a work.
- `assetId` — content-derived fingerprint plus a local UUID fallback.
- `passageId` — deterministic within an extraction version using asset,
  structural path, and normalized text boundaries.
- `annotationId`, `conceptId`, `entityId`, `sceneId`, `artifactId` — stable
  locally generated IDs.

Content fingerprints are deduplication evidence, not permission to merge.
Books may suggest that two assets represent the same work, but destructive or
ambiguous merges require user confirmation.

## Portable record model

The schema-v1 physical layout is locked in
[SEMANTIC-LIBRARY-DECISIONS.md](SEMANTIC-LIBRARY-DECISIONS.md). Its portable
records support structures equivalent to:

```json
{
  "schemaVersion": 1,
  "workId": "work_...",
  "title": "Pride and Prejudice",
  "authors": [{"name": "Jane Austen", "source": "embedded"}],
  "userMetadata": {
    "rating": null,
    "tags": [],
    "shelves": []
  },
  "editions": [
    {
      "editionId": "edition_...",
      "language": "en",
      "identifiers": {},
      "assetIds": ["asset_..."]
    }
  ],
  "legacy": {
    "bookIds": ["pride_and_prejudice"],
    "sourceFilenames": ["Pride and Prejudice.epub"]
  }
}
```

Semantic records carry source provenance:

```json
{
  "conceptId": "concept_...",
  "workId": "work_...",
  "label": "social class",
  "kind": "theme",
  "description": "A generated, editable description.",
  "evidence": [
    {
      "passageId": "passage_...",
      "quoteHash": "sha256:...",
      "weight": 0.92
    }
  ],
  "generatedBy": {
    "runId": "run_...",
    "extractor": "concepts-v1"
  },
  "userState": {
    "hidden": false,
    "labelOverride": null
  }
}
```

## Storage model

The virtual filesystem remains the portability boundary. The schema-v1
storage design distinguishes:

- **Source assets** — immutable and user-exportable.
- **Portable manifests** — works, editions, user metadata, and annotations.
- **Derived semantic records** — passages, entities, concepts, and scenes.
- **Rebuildable indexes** — lexical, semantic, and query caches.
- **Derived media** — covers, illustrations, audio, OCR, and translations.
- **Job state** — resumable processing metadata and failure reports.

The current logical shape is:

```text
library/                       source assets; current path remains readable
catalog/works/<workId>.json    portable work and edition manifests
catalog/views.json             portable saved queries and structured views
annotations/<workId>.json      user-authored annotation records
semantic/<workId>/             passages, entities, concepts, scenes
artifacts/<workId>/            generated covers, images, audio, translations
indexes/                       rebuildable library-wide indexes
jobs/                          resumable pipeline state
```

One maintained catalog may accelerate discovery, but per-work portable records
must be sufficient to rebuild it. The catalog cannot become a single
irrecoverable point of failure.

## Import and understanding pipeline

### Stage I0. Accept and preserve

Validate the file, refuse accidental overwrite, store the original asset, and
create or associate a provisional work record.

### Stage I1. Fingerprint and identify

Compute a fingerprint, inspect embedded metadata, detect exact duplicates, and
suggest edition/work grouping. Do not merge ambiguous records automatically.

### Stage I2. Parse structure

Extract document order, headings, chapters/sections, page relationships,
language hints, authored images, and format-specific anchors.

### Stage I3. Segment passages

Produce normalized passages sized for search, annotations, and model context.
Preserve structural hierarchy and reversible source anchors.

### Stage I4. Build local lexical index

Index passages and user annotations for local full-text search. Indexing is
rebuildable and does not block reading.

### Stage I5. Extract semantic metadata

Extract entities, concepts, themes, claims, relationships, and—for narrative
works—characters, settings, events, and key scenes. Deterministic and
model-assisted results remain distinguishable.

### Stage I6. Optional semantic index

Create embeddings or another semantic retrieval structure using an approved
local or user-consented inference route. Lexical search remains available
without it.

### Stage I7. Generate optional artifacts

Generate covers, illustrations, audio, translation, or other transformations
only under the relevant feature's policy and consent boundary.

Each stage records status independently so a failure or schema upgrade can
resume from the nearest valid stage.

## Library experience

The library evolves from a file list into work-centered views:

- Continue Reading and Recently Added.
- Works with editions and formats grouped together.
- Search across metadata, full text, annotations, entities, and concepts.
- Facets for author, language, series, shelf, tag, format, reading state, and
  generated semantic dimensions.
- User-created shelves and query-driven smart views.
- Work details showing metadata provenance, assets, concepts, scenes,
  annotations, processing status, and derived artifacts.
- Duplicate/grouping suggestions that are reversible and user-confirmed.

Generated concepts never become invisible filters. Users can inspect, rename,
hide, merge, split, or regenerate them. Those decisions are portable
manifest overrides keyed to stable generated identities; rebuilding disposable
semantic records cannot silently erase them.

## Search and questions

### Lexical search

Local, offline search across passage text, titles, authors, metadata, and
annotations. Results show excerpts, work context, and a jump target.

### Semantic search

Optional meaning-based retrieval over approved locally stored semantic
material. Results still cite exact passages.

### Ask this book / Ask the library

Answers are composed only from retrieved passages and user annotations unless
the user explicitly requests broader model knowledge. The response surface:

- Lists the source works used.
- Links claims to passages.
- Distinguishes quotations, source-grounded synthesis, and general model
  knowledge.
- Never edits metadata or notes without an explicit user action.

## Universal annotation model

An annotation target should combine:

- Exact selected text and surrounding text hashes where available.
- `passageId` and offsets in the normalized representation.
- EPUB CFI or Foliate section/fraction fallback.
- PDF page, text-layer selectors, and rectangle fallback.
- Text-document fraction/offset fallback.

If an extraction version changes, Books attempts selector re-anchoring and
surfaces unresolved annotations for repair. It never silently attaches a note
to a merely similar passage.

Annotations can be browsed by book and across the library, searched, filtered,
exported, and linked to concepts or other annotations.

## Reading modes

### Faithful reader

The current engine remains the authority for authored layout, embedded media,
PDF pagination, and source inspection. Semantic features appear as overlays or
adjacent panels without rewriting the book.

### Native reader

The native reader consumes the structured passage representation and provides:

- Responsive reflow independent of source quirks.
- Consistent headings, paragraphs, figures, footnotes, and navigation.
- Font family, justification, spacing, width, color, and accessibility
  controls.
- Stable passage/reference locations.
- Hooks for definitions, concepts, annotations, TTS, translation, and derived
  media.
- A visible route back to the corresponding faithful-source location.

Unsupported structures fall back to faithful mode rather than being silently
flattened or omitted.

## Illustration model

Illustration is a layer on native reading, not a mutation of the book.

- Narrative works select a limited set of key scenes.
- Expository works can illustrate concepts, mechanisms, maps, timelines, or
  relationships.
- Every illustration links to the passages and semantic records that prompted
  it.
- Generated images are clearly identified as generated.
- Regeneration creates a new artifact; it does not overwrite provenance.
- Character/style consistency, model/provider, cadence, controls, caching, and
  automatic versus on-demand generation remain open design decisions.
- Network image generation cannot occur silently during import or reading.

## AI and processing boundary

Books defines capabilities rather than assuming one model:

- `extractMetadata`
- `extractEntities`
- `extractConcepts`
- `extractScenes`
- `embedPassages`
- `answerFromSources`
- `generateIllustration`
- `synthesizeSpeech`
- `translatePassage`

An implementation can satisfy a capability through deterministic code, a
local browser model, NakliOS AI, a user-controlled local service, or a
user-approved remote provider.

Every model-assisted run records:

- Capability and schema version.
- Provider and model identifier.
- Input passage IDs and content hashes.
- User consent/destination class.
- Output IDs, timestamps, status, and errors.

Secrets, raw credentials, and unrelated prompts are never written into library
records.

## Portability and synchronization

### Future standalone folder library

Standalone Books may attach a user-selected directory as a distinct physical
library. Source books remain in place and immutable. Canonical work records,
reading state, annotations, user metadata, and reconciliation history live in
a documented Books-owned sidecar directory within the granted root, rather
than existing only in origin-scoped browser storage.

A directory handle remembered in IndexedDB is only a reconnect convenience.
The folder must remain recoverable after browser site-data loss. Folder
reconciliation is incremental, checkpointed, and non-destructive: lost
permission or a temporarily missing source produces a visible disconnected or
review state, never an inferred permanent delete.

The directory stays compatible with the user's chosen backup or sync tool.
Books does not silently select a cloud transport; externally delivered changes
are reconciled using the library's version, tombstone, and conflict rules.

The design, directory format, and scale gates are pending in Phase 7A of the
work plan.

### Export and restore

An export can include:

- Original assets.
- Work/edition manifests and user metadata.
- Reading state and annotations.
- Selected derived semantic records and media.
- A manifest describing omitted rebuildable indexes.

Import validates versions and preserves unknown forward-compatible fields.

### Future synchronization

Synchronization is explicit and backend-aware. The first sync contract must
define conflict behavior per record type:

- Reading position may use a visible last-read policy.
- Independently identified bookmarks and highlights can merge.
- Concurrent edits to the same note or metadata field require version history
  or a repair surface.
- Deletes need tombstones or another recoverable representation.
- Generated artifacts can be regenerated instead of conflict-merged.

Private-mesh or another sovereign transport can implement the contract later;
the semantic library does not assume a central Books service.

## Security and privacy requirements

- No telemetry about titles, filenames, passages, annotations, searches, or
  concepts.
- No runtime CDN dependency for core reading or indexing.
- Book HTML remains sanitized and isolated; source scripts do not gain Books
  or host capabilities.
- Parser and archive inputs are treated as untrusted and bounded for memory,
  decompression, recursion, and processing time.
- Provider consent is destination-specific and revocable.
- Crate-derived records stay in the active encrypted backend.
- Browser storage communicates quota and persistence risk before data loss.
- Export never includes credentials, transient prompts, or provider tokens.
- Generated summaries and illustrations are labeled and traceable.

## Performance and resilience requirements

- Reading becomes available before background understanding completes.
- Large books are processed incrementally; no full-library synchronous scan on
  the main UI thread.
- Jobs persist checkpoints and can resume after reload or process termination.
- Search indexes can be deleted and rebuilt independently of source records.
- Schema migrations are versioned, idempotent, and recoverable.
- Storage estimates distinguish sources, portable metadata, indexes, and
  generated media.
- Users can pause semantic processing and remove derived data per work or
  library.

## Migration from v1.4

Migration must:

1. Scan existing `library/` assets without moving or rewriting them.
2. Create work, edition, and asset records.
3. Preserve legacy filename-derived `bookId` aliases.
4. Map existing position, bookmarks, note, reader preferences, and cover cache
   to the new records.
5. Keep the old sidecars readable until the new records are verified.
6. Commit a migration marker only after successful validation.
7. Support retry after interruption without duplicate works or annotations.

Rollback means continuing to read through the v1.4 paths. A migration cannot
make the existing faithful reader dependent on semantic processing.

## Locked direction

This proposal locks the following product direction, subject to explicit
future reversal:

- Books grows from a private reader into a private semantic library.
- Source ownership, offline reading, and original-file immutability remain
  foundational.
- Work/edition/asset replaces filename as the long-term identity model.
- Import creates local structured understanding in a background pipeline.
- Semantic and generated records cite their source passages and provenance.
- Faithful and native readers coexist.
- Illustrations and other generated media remain separate derived artifacts.
- No book content is silently transmitted to a provider.
- Browser, Folder, and Crate continue to share contracts but remain isolated.

## Decision ledger

The foundation resolved the decisions required for the approved implementation:

1. **Resolved:** versioned portable manifests plus a rebuildable catalog.
2. **Resolved:** suggested grouping with explicit merge/split controls and
   reversible review.
3. **Resolved:** versioned, format-neutral passages with quote/source anchors
   and resumable invalidation.
4. **Resolved:** a rebuildable local lexical index shared by Browser, Folder,
   and Crate contracts.
5. **Pending separate decision:** embeddings are not required by search or Ask
   and are not stored.
6. **Resolved:** visible local endpoints and destination-specific remote BYOK
   consent in standalone mode; host mediation in NakliOS.
7. **Pending separate decision:** no metadata provider is enabled.
8. **Resolved for the foundation:** Native renders supported passage structure,
   links every passage to Faithful mode, and visibly falls back for unsupported
   or layout-sensitive content. OCR is not implied for scanned PDFs.
9. **Pending explicit product decision:** illustration style, consistency,
   provider, cadence, storage, safety, and controls. No illustration generation
   is implemented.
10. **Resolved:** schema-versioned portable JSON bundles preserve originals,
    manifests, views, user metadata, annotations, and checksums; rebuildable
    indexes are declared omissions.
11. **Resolved at the record-contract layer:** versions, tombstones, and
    conflict semantics are documented. No sync transport is enabled.
12. **Resolved for the current scope:** the Calibre Adopt/Adapt/Reject
    dispositions are recorded in the work plan; separate bets remain parked.

## Acceptance criteria for the semantic foundation

Before higher-level semantic features are considered stable:

- Importing an existing supported book produces valid work, edition, asset,
  passage, and processing records without changing the source bytes.
- Existing v1.4 positions, bookmarks, notes, preferences, and covers survive
  migration.
- A failed parser or model run never blocks faithful reading.
- Local lexical search returns cited passages and works offline.
- Removing indexes leaves portable records and source files intact.
- Generated concepts expose evidence and processing provenance.
- Browser, Folder, and Crate pass the same logical contract tests.
- No provider receives content without destination-specific consent.
- Export and re-import preserve user-authored metadata and annotations.

## Inputs and companion documents

- [SPEC.md](SPEC.md) — shipped v1.4 reader architecture.
- [CALIBRE-RESEARCH.md](CALIBRE-RESEARCH.md) — comparison inventory, not a
  parity mandate.
- [DEFERRED.md](DEFERRED.md) — history and revisit triggers for parked work.
- [SEMANTIC-LIBRARY-WORKPLAN.md](SEMANTIC-LIBRARY-WORKPLAN.md) — proposed
  sequencing, gates, and complete pending-item mapping.
