# Books storage and recovery

Books treats each Browser, Folder, or Crate backend as an independent library.
A shelf is metadata inside one library; it never spans or copies backends.

## Data classes

- `library/`: immutable original source bytes.
- `catalog/works/`, `catalog/views.json`, `annotations/`, and `notes/`:
  portable, user-owned records.
- `catalog/catalog.json`: disposable discovery projection.
- `passages/`, `indexes/`, `semantic/`, `jobs/`, and `covers/`: derived,
  rebuildable data.
- `trash/`: recoverable sources and deletion metadata.

The in-app storage map measures these classes separately. Clearing derived data
does not remove originals, manifests, saved views, reading state, annotations,
Trash, or provider settings.

## Browser storage

Standalone Books requests persistent storage when the browser supports it.
Persistence is a request, not a guarantee; browser policy and the user's device
remain authoritative.

- Books should use `navigator.storage.estimate()` for device-level quota and
  usage when available, alongside its own per-class accounting.
- Below 15% estimated free quota, imports and generated media should show a
  warning before writing.
- Below 5%, optional processing and generated-media jobs should pause; faithful
  reading and export remain available.
- Books never silently deletes originals or portable records to make space.
- Rebuildable covers, indexes, passages, semantic records, and job history are
  the only automatic-eviction candidates, and automatic eviction requires a
  separately approved policy. The current build uses explicit cleanup.
- A user should export a portable bundle before clearing site data or moving to
  a new browser profile.

## Standalone Folder storage

Folder sources are read in place. Canonical records and rebuildable derived
artifacts live under the granted root's `.books/` directory. IndexedDB stores
only a remembered directory handle, so clearing browser site data removes that
convenience but not the Folder library.

Reconnect by choosing the same root again. Books validates `.books/library.json`,
opens the last complete inventory immediately, then reconciles the directory
in the background. Permission loss is reported as disconnection; it does not
mark sources deleted. A unique SHA-256 match recovers work identity after a
move or rename, while an ambiguous match remains for review.

The native indexer and browser share stage leases. An unexpired foreign lease
prevents concurrent writes to the same work; an expired lease may be reclaimed.
Malformed or missing derived vector shards are ignored and regenerated.

## Recovery order

1. Validate original paths and canonical portable records.
2. Restore Trash items when requested.
3. Rebuild `catalog/catalog.json` from work manifests.
4. Reconcile legacy sidecars into portable annotations.
5. Re-anchor annotations against current passage records; surface ambiguous
   anchors instead of guessing.
6. Rebuild passages, lexical indexes, and deterministic concepts.
7. Re-run optional model enrichment only with a currently allowed provider.

An interrupted import, Trash restore, catalog rebuild, or derived-data rebuild
is safe to retry. Conflicting source bytes or canonical JSON stop before
overwrite.

## Operator checks

- Export and validate a bundle periodically for irreplaceable libraries.
- Keep the original Folder or Crate backup outside browser-only storage.
- Treat malformed archives, PDFs, EPUB HTML, and metadata as untrusted input.
- Use Library tools to validate after manual file changes.
- Do not diagnose missing generated concepts by modifying source files; inspect
  processing state, clear derived data if appropriate, and rebuild.
