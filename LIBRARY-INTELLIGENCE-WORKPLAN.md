# Books library-intelligence workplan

**Status:** Complete — Books 2.0, 2026-07-30

## Goal

Turn Books into a durable private semantic library that works both standalone
and inside NakliOS:

- Existing folders can be opened as libraries without copying their books.
- Canonical metadata survives browser-site-data loss because it lives beside
  the collection in a documented Books sidecar.
- Browser and native indexers share one resumable job and artifact format.
- Every processed book emits source-grounded ideas, not only keywords.
- Library-level search can find and relate ideas across books with citations.

The permission-free Browser backend remains available. Browser, standalone
Folder, NakliOS Folder, and Crate are separate physical libraries and never
merge implicitly.

## Architecture

One portable library format has two processing executors:

1. A resource-aware browser worker for incremental parsing, compact local
   embeddings, and optional local/BYOK extraction.
2. A native disk indexer for large collections and faster CPU/GPU processing.

Both consume the same durable jobs and write the same versioned derived
records. Library-level idea links are derived from source-grounded per-book
records; user curation is a canonical overlay and survives regeneration.

## Milestone 1 — Folder Library Core

**Status:** Complete

- Add **Add folder** in standalone mode through the File System Access API.
- Keep the existing IndexedDB Browser backend.
- Recursively enumerate supported books in a selected folder.
- Exclude the reserved Books sidecar, hidden/system folders, and explicit
  ignored paths.
- Read originals in place through the existing `naklios.fs` contract.
- Store canonical metadata under a versioned reserved sidecar directory.
- Remember the directory handle only as a reconnect convenience.
- Expose disconnected permission as recoverable state, never deletion.
- Keep a known book openable while reconciliation continues.

## Milestone 2 — Incremental reconciliation

**Status:** Complete

- Persist inventory generations containing normalized relative path, type,
  size, modification time, last-seen generation, and fingerprint state.
- Hash and parse only new or plausibly changed sources.
- Detect moves and renames by strong source fingerprint.
- Route missing sources through unavailable/tombstone review.
- Keep the cheap tree scan observable and restartable; put expensive hashing
  and parsing in the pausable, per-work cancellable durable queue.
- Refresh after connect, on load, and on focus; do not promise a native browser
  filesystem watcher.
- Advance complete inventory generations only after their sidecar write closes;
  native writes use `fsync` plus atomic replacement.

## Milestone 3 — Shared durable processing queue

**Status:** Complete

Replace the current sequential manifest loop with durable per-asset jobs:

```text
discovered
  -> fingerprinted
  -> parsed
  -> passages-built
  -> lexical-indexed
  -> ideas-extracted
  -> ideas-embedded
  -> library-linked
  -> ready
```

Each stage records the source fingerprint, input/output schema versions,
extractor/provider/model identity, progress checkpoint, attempts, errors,
artifact location, and executor lease. Outputs are idempotent and invalidated
only when their own inputs or pipeline versions change.

## Milestone 4 — Quiet browser intelligence

**Status:** Complete

- Use a compact embedding encoder for semantic retrieval. Do not require a
  multi-gigabyte chat model merely to create vectors.
- Download a background model only after explicit opt-in; cached models may
  subsequently load quietly.
- Process one book at a time and yield to reading and interactive AI.
- Pause under critically low battery, before a model download under Data Saver,
  during interactive AI, or under explicit user control. Yield between works so
  reading remains responsive without stalling a long background queue.
- Use Gemma E2B/E4B, NakliOS AI, Ollama, LM Studio, or remote BYOK only for
  capabilities that require structured generative extraction.
- Preserve lexical search and reading when AI is disabled.

## Milestone 5 — Native disk indexer

**Status:** Complete

- Add a `books-index` CLI/script that opens a Books folder recursively.
- Support local CPU/GPU models and OpenAI-compatible local endpoints.
- Claim and complete the same jobs as the browser.
- Write versioned passages, ideas, embedding shards, provenance, checksums,
  and generation manifests into the Books sidecar.
- Never persist credentials in the library.
- A future native watcher may rerun this same reconciliation command; the
  shipped indexer intentionally does not introduce a second change protocol.

## Milestone 6 — Library idea graph and hybrid search

**Status:** Complete

- Replace keyword-only matching with source-grounded idea records: claims,
  mechanisms, principles, questions, themes, motifs, relationships, and
  narrative events.
- Embed idea statements plus bounded evidence context.
- Retrieve a small nearest-neighbour candidate set rather than comparing every
  pair.
- Classify typed relationships such as `same_as`, `supports`, `contradicts`,
  `extends`, `example_of`, `applies_to`, and `shares_mechanism`.
- Keep book-specific ideas intact; do not silently collapse them into one
  canonical concept.
- Store relationship score, provenance, model/extractor versions, and evidence.
- Combine lexical passage and idea-vector signals without making semantic
  retrieval a prerequisite for offline search.
- Make every result open its exact source passage.

## Milestone 7 — Scale, recovery, and release

**Status:** Complete

- Validate cold scan, warm no-change scan, one-file change, bulk add, move,
  rename, external delete, and interrupted writes.
- Benchmark a real 1k-file native collection and a 10k-record reconciliation
  contract.
- Exercise browser/native lease contention and malformed/partial sidecars.
- Verify site-data deletion followed by folder reconnect restores canonical
  records.
- Verify standalone Browser, standalone Folder, NakliOS Folder, and Crate.
- Build, deploy, smoke-test `books.naklitechie.com`, then commit and push.

## Portable folder contract

The reserved directory is `.books/`. The binding schema and recovery rules are
in [FOLDER-LIBRARY-FORMAT.md](FOLDER-LIBRARY-FORMAT.md).

```text
<root>/
  <books in arbitrary folders>
  .books/
    library.json
    inventory/
    catalog/works/
    annotations/
    jobs/
    semantic/<workId>/
    indexes/works/
    indexes/idea-embeddings/
    indexes/library-idea-graph.json
    covers/
    trash/
```

Originals are immutable unless the user invokes a separate, explicit file
operation. Work identity, reading state, annotations, metadata edits, shelves,
views, curation, tombstones, and conflicts are canonical. Extracted passages,
generated ideas, embeddings, indexes, processing logs, and relation graphs are
derived and rebuildable.

## Exit criteria

- A known book opens without waiting for a recursive scan.
- A warm scan is proportional to changed inventory, not total book content.
- Browser and native executors can resume the same job safely.
- Removing browser site data does not remove folder-library reading history.
- Cross-book idea relationships retain passage evidence and provenance.
- Disabling AI leaves faithful reading, native reading, annotations, metadata,
  and lexical search usable.
- Standalone and NakliOS contract suites pass before push.

## Completion evidence

- The regular test suite exercises recursive reconciliation, warm no-change
  scans, one-file changes, missing files, unique-fingerprint renames, shared
  lease/cancellation behavior, binary vector compatibility, graph relations,
  native indexing, security, and deployment artifacts.
- The scale contract reconciles 10,000 inventory records and builds a bounded
  candidate graph over 3,000 ideas.
- The native 1,000-file Markdown benchmark completed in 3.25 seconds cold and
  0.66 seconds warm on the release-development machine; results are
  environment-specific and reproducible with `npm run benchmark:indexer`.
- The Chrome host harness passes semantic reading, smart views, enrichment,
  grouping, cited Ask, portability, recovery, and rebuild in NakliOS mode.
- The local-AI fallback harness completes the Gemma 4 E2B download, WebGPU
  initialization, warm-up, source-grounded generation, and citation check.
- Standalone Browser and Folder affordances render from the same production
  artifact. The File System Access picker remains a browser-owned permission
  surface and reconnects through a remembered handle when permission persists.
