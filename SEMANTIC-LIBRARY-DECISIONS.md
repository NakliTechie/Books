# Books semantic-library decisions

> **Status:** Accepted foundation decisions.
>
> **Accepted:** 2026-07-30.
>
> These decisions constrain implementation of
> [SEMANTIC-LIBRARY-SPEC.md](SEMANTIC-LIBRARY-SPEC.md). Reversing one requires a
> migration and an explicit decision update; implementation convenience alone
> is not sufficient.

## Product slice

The first complete semantic-library outcome is:

> A user adds any supported, unprotected book and can read it immediately.
> Books then structures and indexes it locally in the background, exposes
> library-wide search and editable concepts with source citations, and retains
> everything needed to rebuild derived intelligence without changing the
> original.

Native reflow, universal annotations, and illustrations build on this outcome.
They do not block faithful reading or the first local index.

## D1 — Identity

**Decision:** A Work, Edition, and Asset each receive a stable local ID when
the source first becomes managed.

- `workId` and `editionId` are UUID-backed local IDs.
- `assetId` begins as a UUID-backed fallback so import and reading never wait
  for hashing.
- A later SHA-256 fingerprint is stored as deduplication evidence on the asset;
  discovering it does not change the stable `assetId`.
- Existing filename-derived `bookId` values remain aliases.
- One previously unknown source initially creates one Work, one Edition, and
  one Asset.
- Exact fingerprints can suggest duplicates. Embedded identifiers and metadata
  can suggest editions. Ambiguous items never merge without confirmation.

## D2 — Canonical and rebuildable storage

**Decision:** Versioned per-work JSON manifests are canonical. A maintained
catalog accelerates discovery but is disposable.

```text
library/                       immutable source assets
notes/                         readable v1.4 sidecars during migration
catalog/works/<workId>.json    canonical work/edition/asset manifests
catalog/catalog.json           rebuildable discovery catalog
annotations/<workId>.json      canonical user-authored reading records
semantic/<workId>/             rebuildable passages and extracted knowledge
indexes/                       rebuildable search and embedding indexes
artifacts/<workId>/            rebuildable or exported derived media
jobs/                          resumable processing state
```

Manifests are written before the catalog. A missing or corrupt catalog is
rebuilt by scanning manifests. A migration never deletes a source or v1.4
sidecar. Newly migrated records are additive until validation succeeds.

## D3 — Passage anchors

**Decision:** A portable target combines authored text evidence with an
engine-specific fallback.

Every Passage has:

- A deterministic ID within the parser/extraction version.
- Normalized text and a hash of a short exact quote.
- A structural path such as chapter/heading/paragraph.
- Normalized start/end offsets in the extracted asset text.
- An engine fallback:
  - EPUB/Foliate: CFI plus section index and fraction.
  - PDF: page number, text item range, and optional normalized rectangle.
  - Text/Markdown/HTML: normalized character range plus document fraction.

Resolution attempts the precise engine locator, then structural/offset data,
then quote matching. If all fail, Books reports the anchor as unresolved; it
does not silently jump to an unrelated passage.

## D4 — Lexical indexing

**Decision:** Offline lexical search uses a sharded inverted index built from
normalized Passages, metadata, and annotations.

- Each work owns rebuildable passage shards.
- The library index maps normalized terms to work/passage postings.
- Writes are revisioned and replace one shard at a time.
- Phrase verification uses stored passage text rather than positional claims
  from a stale index.
- No remote service is required.
- Initial target budget: index plus normalized passage text should remain below
  35% of extracted UTF-8 text size for ordinary prose. Actual usage is
  measured and surfaced rather than assumed.

Embeddings are optional additional indexes and cannot be required for lexical
search.

## D5 — Extraction and AI

**Decision:** Parsing, structure, language hints, authored metadata, passage
segmentation, and lexical indexing are deterministic local stages. Concepts,
entities, scenes, summaries, and illustrations may use a local or BYOK
provider through one capability interface.

Local/BYOK inference is available through NakliOS, the built-in Gemma 4
E2B/E4B WebGPU sidecar, or a visible OpenAI-compatible endpoint, with these
boundaries:

- No content leaves the active device or origin silently.
- E2B is the recommended smaller built-in model; E4B remains selectable for
  higher quality. The visible selection starts downloading only after an
  explicit Load action and runs in a dedicated browser Worker.
- A local endpoint route may be enabled once its endpoint and model are
  visible to the user. Ollama and LM Studio presets include a connection test
  that discovers OpenAI-compatible model identifiers.
- A remote BYOK route requires provider-specific consent before book content
  is sent.
- Credentials live in host/provider configuration, never in a book manifest,
  export, or log.
- Each generated record stores provider class, model, prompt/configuration
  hash, extractor version, evidence Passage IDs, and timestamps.
- Disabling AI leaves import, faithful reading, native reflow, metadata,
  annotations, and lexical search available.

## D6 — Migration and rollback

**Decision:** Migration is idempotent, additive, and safe to interrupt.

- A source already named in a valid Work manifest never receives another
  identity on retry.
- Missing sources mark Assets unavailable but do not erase manifests.
- Malformed new records are ignored and reported; the v1.4 source scan remains
  usable.
- A catalog write happens only after changed manifests are durable.
- Rollback to v1.4 consists of ignoring new directories; original source files
  and sidecars remain readable.
- Fingerprinting and semantic processing are queued after reading readiness.

## D7 — Calibre feature disposition

| Capability family | Decision | Books interpretation |
|---|---|---|
| Work records and multiple formats | Adapt | Work/Edition/Asset with confirmed grouping |
| Rich metadata | Adapt | User-owned fields and optional provenance-bearing enrichment |
| Shelves, tags, saved views | Adapt | Lightweight organization over portable fields |
| Library full-text search | Adopt | Offline, passage-grounded, rebuildable |
| Highlights and annotations | Adopt | Universal anchors and library-wide recall |
| Reader depth | Adapt | Native reflow, accessibility, TTS/dictionary capabilities |
| Export, validation, recovery | Adopt | Originals plus portable manifests and user data |
| Format conversion and polishing | Separate bet | Non-destructive workflow with its own spec |
| Source editing and comparison | Reject for core | Conflicts with immutable originals |
| Hardware device drivers | Reject for web app | Native bridge or external tool concern |
| Content server / sync | Adapt later | Private continuity, not a desktop server clone |
| News/RSS acquisition | Separate bet | Reading-inbox product |
| Plugin marketplace | Reject for first releases | Prefer narrow permissioned capabilities |
| CLI and automation | Adapt later | Stable schema/capability contracts first |
| DRM circumvention | Reject | Protected assets remain unsupported |

## D8 — First implementation sequence

1. Add identity records, rebuildable catalog, and safe v1.4 migration.
2. Migrate user-authored reading data into portable annotations while
   retaining sidecars as rollback inputs.
3. Add resumable passage extraction and lexical search.
4. Add source-grounded concepts through deterministic/local/BYOK stages.
5. Expose work-centered library, annotations, and processing controls.
6. Build native reflow and then derived illustrations.

Metadata-provider downloads, format conversion, source editing, device
drivers, news acquisition, and a plugin marketplace are excluded from the
first semantic-library outcome.
