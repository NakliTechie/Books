# Books private-continuity sync contract

> **Status:** Record-level contract locked; no automatic sync transport ships.
>
> **Contract version:** `1`

Books may eventually synchronize user-owned libraries through Crate,
private-mesh, or another sovereign transport. A transport is allowed to move
encrypted bytes and version envelopes; it does not get to invent merge rules.
This document defines those rules before any automatic synchronization exists.

Browser, Folder, and Crate remain separate libraries today. Export/import and
backend switching are explicit. Nothing in this contract authorizes silent
copying between them.

## Revision envelope

Every sync-capable portable record is represented by an envelope:

```json
{
  "contractVersion": 1,
  "recordType": "books.work",
  "recordId": "work_…",
  "schemaVersion": 1,
  "revisionId": "sha256:…",
  "parents": ["sha256:…"],
  "payloadHash": "sha256:…",
  "updatedAt": "2026-07-30T12:00:00.000Z",
  "actorId": "device_…",
  "deletedAt": null
}
```

- `recordId` is the stable Books identity, never a filename or display label.
- `revisionId` is a hash of record identity, ordered parent revision IDs, and
  `payloadHash`.
- `parents` make ancestry explicit. One parent is a normal edit; two or more
  parents identify a reviewed merge.
- `actorId` is a library-local random device identity. It is not an account,
  advertising identifier, or telemetry key.
- Timestamps help the user understand history. They never determine ancestry.
- Unknown forward-compatible payload fields are retained.

If one revision descends from the other, synchronization fast-forwards. If
neither descends from the other, the revisions are concurrent and the
record-type rules below apply. A deterministic `revisionId` lexical order may
break a display tie, but it may not discard either payload.

## Record behavior

### Original assets and editions

Original bytes are immutable and addressed by SHA-256 fingerprint.

- Equal fingerprints deduplicate transfer.
- Equal asset IDs with different fingerprints are a blocking integrity error.
- Equal destination filenames with different bytes require an explicit rename
  or work/edition review; neither side overwrites the other.
- Availability and Trash changes are metadata revisions, not source mutation.

### Work manifests and metadata

Work identity, edition identity, and asset identity are structural fields.
Concurrent structural edits require a review surface.

- Tags and shelves merge as set union.
- Concept-curation entries with different concept IDs merge independently.
- Concurrent title, author, rating, grouping, or same-concept curation changes
  preserve both revisions and require the user to choose or edit a result.
- A reviewed resolution creates a revision with both conflicting revisions as
  parents.

### Positions

Reading positions retain history per work and asset. The default visible
position is the position with the latest valid `readAt`. A deterministic
revision-ID tie-break makes the result stable, while the alternate position
remains available in recent-position history.

### Bookmarks, highlights, and notes

Annotations merge by stable annotation ID.

- Independently created IDs merge as a union.
- Edits to different IDs merge independently.
- Concurrent edits to the same ID preserve both bodies and require review.
- A deletion is an annotation tombstone. It wins automatically only when it
  descends from the edited revision; a concurrent edit/delete is surfaced.
- Re-anchoring changes selectors on the annotation revision and never changes
  its identity.

### Saved library views

Views merge by stable `viewId`.

- Different IDs merge as a union.
- The same ID with identical content is idempotent.
- Concurrent query, filter, sort, or name changes preserve both revisions and
  require review.
- Deletion uses a tombstone so an older device cannot resurrect the view.

### Trash and permanent deletion

Trash is recoverable state. A Trash tombstone includes the stable record or
asset identity, prior path, revision ancestry, and deletion time. Restoring
creates a descendant revision; it does not erase the Trash event.

Permanent deletion is a separate confirmed action. A transport must propagate
the permanent tombstone before it discards its local source bytes. Retention
and garbage-collection policy must be visible to the user.

### Derived passages, indexes, semantics, and media

Derived data is excluded by default.

- Lexical indexes and processing checkpoints are regenerated locally.
- Concepts, entities, scenes, and generated media may be transferred only as
  explicitly selected artifacts with extractor/model, input hashes, evidence
  IDs, and run provenance.
- Competing generated versions are alternatives, not merge candidates.
- Portable concept curation stays in the work manifest and overlays whichever
  derived version is active.

## Sync operation

A future synchronization run must be:

1. Explicitly enabled for a named source and destination.
2. Read-only during discovery and comparison.
3. Presented as additions, fast-forwards, conflicts, tombstones, and byte
   transfers before mutation.
4. Resumable and idempotent by revision and asset fingerprint.
5. Transactional per record: canonical metadata is durable before disposable
   catalogs or indexes rebuild.
6. Cancellable without leaving an identity silently claimed by two works.

There is no “last writer wins” fallback for user-authored text or identity.

## Privacy and transport requirements

- Content, filenames, titles, annotations, queries, concepts, and credentials
  never enter telemetry or plaintext logs.
- Crate/private-mesh transports carry end-to-end encrypted payloads. Temporary
  plaintext files are forbidden.
- A transport receives only the selected library and record scope.
- Provider credentials and AI prompt history are never sync payloads.
- Sync remains useful with AI disabled and with all derived artifacts omitted.

## Required tests before a transport ships

- Fast-forward, independent-ID union, and every concurrent conflict class are
  deterministic across devices.
- Retry after interruption is idempotent.
- Concurrent edit/delete never silently loses user-authored content.
- Old tombstones do not resurrect records.
- Unknown fields survive download, review, merge, and upload.
- Crate/private-mesh traces contain no plaintext library data.
- Discarding every derived record still leaves a readable, recoverable
  library.
