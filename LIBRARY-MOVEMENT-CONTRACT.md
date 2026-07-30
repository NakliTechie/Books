# Books library movement contract

> **Status:** Proposed contract; cross-backend copy/move and multiple-root UI
> remain disabled pending product approval.
>
> **Date:** 2026-07-30

Browser, Folder, and Crate are separate physical libraries. Shelves and saved
views organize works inside one library; they do not blur storage ownership.
Any cross-backend operation must therefore be an explicit, recoverable
transfer rather than an ordinary metadata edit.

## Operations

- **Copy:** create a verified destination asset and merge selected portable
  records; leave the source library unchanged.
- **Move:** perform a successful copy, then place the source asset and its
  source-only records in recoverable Trash. Permanent deletion is never part
  of the transfer transaction.
- **Metadata-only copy:** copy portable work metadata and annotations without
  source bytes only when the destination already has the exact source
  fingerprint.
- **Link:** not supported across Browser, Folder, and Crate. A link would make
  one library's readability depend on another backend's permission and
  lifecycle.

## Preflight

Before writing, Books presents:

- source and destination backend labels;
- work, edition, and selected asset IDs;
- source filenames, sizes, formats, and strong fingerprints;
- destination quota/permission state;
- exact duplicates and conflicting filenames/fingerprints;
- portable record classes to include;
- rebuildable derived classes that will be omitted;
- whether the final action is Copy or Move.

A filename match is never enough to overwrite or merge. An exact strong
fingerprint may reuse destination bytes; ambiguous work grouping remains a
separate confirmation.

## Transaction record

Each side writes `transfers/<transferId>.json` with:

```json
{
  "schemaVersion": 1,
  "recordType": "books.library-transfer",
  "transferId": "transfer_uuid",
  "operation": "copy",
  "source": {
    "libraryId": "source-library",
    "backend": "browser",
    "workId": "work_uuid",
    "assetIds": ["asset_uuid"]
  },
  "destination": {
    "libraryId": "destination-library",
    "backend": "fsa"
  },
  "stage": "prepared",
  "assets": [{
    "assetId": "asset_uuid",
    "sourceFilename": "Example.epub",
    "destinationFilename": "Example.epub",
    "byteLength": 123,
    "fingerprint": "sha256:..."
  }],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

Stages are:

```text
prepared
copying-assets
verifying-assets
merging-portable-records
committing-destination
trashing-source (Move only)
complete
failed
rolled-back
```

Credentials, directory handles, provider settings, and raw prompts never enter
the record.

## Commit order

1. Write `prepared` transfer records.
2. Copy each source to a destination temporary name inside the destination
   library.
3. Verify byte length and strong fingerprint from the destination read.
4. Commit verified destination assets without overwriting unrelated bytes.
5. Merge work, edition, annotation, reading-state, shelf, and curation records
   using the existing version/conflict contract.
6. Rebuild the destination catalog.
7. Mark the destination transfer `complete`.
8. For Move only, place source assets and source-only portable records in
   recoverable Trash, then mark the source transfer `complete`.

Derived passages, embeddings, idea graphs, OCR, illustrations, thumbnails,
and AI runs are omitted by default and rebuilt at the destination. A future UI
may allow explicitly copying large derived media, but it cannot make the
source transfer less recoverable.

## Failure and recovery

- Failure before destination commit removes only transaction-owned temporary
  files.
- Failure after destination commit leaves a valid Copy and never proceeds to
  source Trash.
- A reload resumes from the last durable stage and re-verifies existing
  destination bytes.
- A changed source fingerprint pauses the transfer for a new preflight.
- Lost source or destination permission pauses; it is not a delete.
- Duplicate transfer IDs and repeated stages are idempotent.
- Rollback never removes a destination asset that predated the transaction.

## Multiple physical roots

The first multiple-root UI should be a library switcher, not one merged
catalog. Each root retains its own `libraryId`, `.books/` sidecar, permissions,
processing queue, and Trash. A later federated search may query connected
roots while displaying the owning library on every result, but it may not
silently transfer records or make one root canonical for another.

## Approval gate

Implementation remains disabled until the user approves:

1. whether both Copy and Move are required in the first slice;
2. which portable record classes are selected by default;
3. whether a federated read-only search across connected roots is desirable;
4. whether derived illustrations/media may be copied instead of rebuilt.
