# Books portable-library bundle

> **Format:** `books.portable-library`
>
> **Bundle version:** `1`

Books exports a library as UTF-8 JSON with the filename suffix
`.books-library.json`. The bundle is intended for user-controlled backup and
movement between Browser, Folder, and Crate libraries. It is not a derived
cache dump.

## Included

- Every available original source file, encoded as base64 without changing its
  bytes.
- The SHA-256 fingerprint and byte length of each included original.
- Canonical per-work manifests, including work, edition, asset, and user-owned
  metadata.
- Portable annotation records, including highlights, bookmarks, notes,
  positions, and reader preferences.
- Legacy sidecars while the v1.4 compatibility window remains open.
- Portable saved library views, including query, structured shelf/tag/reading
  filters, and sort order.
- The semantic schema and export timestamp.

## Deliberately omitted

The maintained catalog, passage cache, lexical indexes, semantic extraction
outputs, processing jobs, and cover thumbnails are rebuildable. Their
namespaces are listed in `omittedRebuildableData` rather than copied into the
bundle.

## Top-level shape

```json
{
  "bundleVersion": 1,
  "recordType": "books.portable-library",
  "semanticSchemaVersion": 1,
  "exportedAt": "2026-07-30T12:00:00.000Z",
  "libraryLabel": "Folder",
  "assets": [
    {
      "filename": "Example.epub",
      "byteLength": 12345,
      "fingerprint": "sha256:…",
      "dataBase64": "…"
    }
  ],
  "records": {
    "works": [],
    "annotations": [],
    "legacySidecars": [],
    "views": {
      "schemaVersion": 1,
      "recordType": "books.library-views",
      "revision": 1,
      "views": [],
      "updatedAt": "2026-07-30T12:00:00.000Z"
    }
  },
  "omittedRebuildableData": [
    "catalog/catalog.json",
    "passages/",
    "indexes/",
    "semantics/",
    "processing/",
    "covers/"
  ]
}
```

Unknown fields are retained when canonical records are imported and written
back. A bundle with a newer top-level bundle version or unsupported semantic
schema is rejected.

## Import safety

Import has a read-only preflight before confirmation or storage writes:

1. Validate bundle and record versions.
2. Reject unsafe filenames and record identities.
3. Decode every source and verify its byte length and SHA-256 fingerprint.
4. Compare every destination path with existing data.
5. Merge saved views with different stable identities, but stop if the same
   view identity contains different data.
6. Stop the complete import if any other destination contains different bytes
   or JSON. Books never silently overwrites a conflicting book or portable
   record.

After a successful preflight and user confirmation, missing records are
written. Identical existing records are skipped. The process is idempotent:
retrying the same bundle resumes an interrupted import without duplicating
works or annotations. The disposable catalog and local indexes rebuild from
the imported originals and canonical records.
