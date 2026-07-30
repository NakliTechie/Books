# Books folder-library format

> **Status:** Shipped in Books 2.0
>
> **Sidecar:** `.books/`

A Folder library is an ordinary user-owned directory. Supported book files may
sit anywhere below its root. Books reads those sources in place and writes only
inside the reserved `.books/` directory unless the user explicitly invokes a
separate source-file operation.

The format is shared by the standalone browser and
`scripts/books-index.py`. A directory handle remembered in browser IndexedDB is
only a reconnect convenience; it is never the canonical copy of Folder
metadata.

## Layout

```text
<library root>/
  Fiction/
    Example.epub
  Research/
    Paper.pdf
  .books/
    library.json
    inventory/
      current.json
      generations/00000001.json
    catalog/
      catalog.json
      views.json
      works/<workId>.json
    annotations/<workId>.json
    notes/<legacyBookId>.json
    semantic/<workId>/
      passages.json
      records.json
      ideas.json
    indexes/
      works/<workId>.json
      idea-embeddings/<workId>.json
      idea-embeddings/<workId>.f32
      library-idea-graph.json
    jobs/<workId>.json
    covers/
    trash/
```

Work manifests, annotations, user metadata, reading state, saved views, and
curation are canonical. The catalog projection, passages, deterministic/model
semantics, embeddings, graph, jobs, and covers are derived and rebuildable.
Legacy `notes/` remain readable during migration.

## Root manifest

`.books/library.json` has `recordType: "books.folder-library"`, schema version
1, a stable random `libraryId`, the display `rootName`, the reserved sidecar
name, and the policies `sourcePolicy: "read-in-place"` and
`canonicalMetadata: "sidecar"`.

## Recursive inventory

Each complete scan writes a new generation before replacing
`inventory/current.json`. A file record contains:

- normalized root-relative path using `/`;
- format, media type, byte length, and modification time;
- strong SHA-256 fingerprint and fingerprint status;
- last-seen generation.

The cheap pass compares path, byte length, and modification time. Existing
fingerprints survive an unchanged scan. Only new or plausibly changed sources
enter the durable fingerprint/parsing queue. Missing records retain their last
strong fingerprint and are not treated as destructive deletion.

Paths are NFC-normalized and also grouped by a case-folded collision key.
Distinct paths such as `Fiction/Book.epub` and `fiction/book.epub` remain
separate records but produce a reviewable collision; Books never silently
chooses one. Native fingerprinting compares file metadata before and after the
read. A source that continues changing is marked `unstable`, remains readable,
and waits for a later scan instead of producing derived data from partial
bytes.

Books excludes `.books`, `.git`, `.hg`, `.svn`, `node_modules`, hidden
directories, hidden files, and symlinks. It never follows a path outside the
granted root.

A unique strong-fingerprint match between one missing path and one new path is
a rename: the original work and asset IDs are rebound to the new path. An
ambiguous match remains unresolved for review.

## Shared processing jobs

`jobs/<workId>.json` uses `recordType: "books.processing-run"` and schema
version 2. Browser and native executors use the same stages:

```text
fingerprint
passages
lexicalIndex
deterministicSemantics
modelSemantics
embeddings
libraryLinks
```

Each stage records status, attempts, update time, input fingerprint, artifact
path/version, and relevant extractor/provider/model provenance. A job can be
paused, cancelled, retried, or resumed. Its lease names the executor, has a
15-minute expiry, and is renewed between stages. Another executor may claim an
expired lease, but never an active foreign lease. Writes are idempotent against
the source fingerprint and stage version.

## Idea-vector shards

`indexes/idea-embeddings/<workId>.json` is a small manifest. Version 2 rows map
`ideaId` to a zero-based vector index and point to a sibling `.f32` shard.

The binary shard is little-endian:

```text
offset  size  value
0       4     ASCII "BIE1"
4       4     unsigned row count
8       4     unsigned dimensions
12      ...   row-major IEEE-754 Float32 values
```

Readers validate magic, row count, dimensions, and exact byte length before
using the shard. Version 1 JSON rows with inline vectors remain readable, but
new writes use the compact binary format.

The default browser/native-compatible encoder identity is
`Xenova/all-MiniLM-L6-v2`, 384 dimensions, normalized. Other local endpoint
models remain valid but form a separate graph until queries use the same
model.

## Idea graph

Per-work `ideas.json` records retain bounded evidence excerpts and passage IDs.
`indexes/library-idea-graph.json` stores cross-work candidate links, relation
type, score, evidence passage IDs, candidate strategy, and model/classifier
provenance. It never silently merges two ideas.

Small libraries use exact all-pairs comparison. Above 2,048 ideas, Books uses
bounded multi-table vector-signature candidates before exact cosine scoring,
avoiding quadratic comparison while retaining a deterministic rebuild path.

## Write and recovery rules

- Native JSON and vector writes use same-directory temporary files, `fsync`,
  and atomic replacement.
- Browser Folder writes close their File System Access writable before the
  generation pointer is advanced.
- Generation files are written before `current.json`.
- If `current.json` is malformed or incomplete, the native executor recovers
  the latest completed generation before diffing.
- A malformed or partial derived artifact is ignored and rebuilt.
- Catalog loss rebuilds from work manifests.
- Browser-site-data loss is recovered by granting the folder again; canonical
  records remain in `.books/`.
- Permission loss is disconnection, never deletion.
- Originals and portable records are never evicted to make room for derived
  data.

## Provider boundary

The deterministic pipeline and lexical search are offline. The compact browser
encoder downloads only after explicit Background Intelligence opt-in. Gemma,
NakliOS AI, Ollama, LM Studio, or remote BYOK are optional for richer
source-grounded extraction and relation classification.

Remote content requires destination-specific consent. API keys are
session-only in the browser and CLI-only/environment-only in the native
indexer; credentials are never persisted in the library.
