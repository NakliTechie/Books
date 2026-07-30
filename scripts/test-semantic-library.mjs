import assert from 'node:assert/strict';
import {
  SEMANTIC_CATALOG_PATH,
  SEMANTIC_ANNOTATIONS_PREFIX,
  SEMANTIC_SCHEMA_VERSION,
  SEMANTIC_WORKS_PREFIX,
  legacyBookIdFor,
  reconcileLegacyAnnotations,
  reconcileSemanticLibrary,
  rebuildCatalog,
  semanticAnnotationsPath,
  semanticManifestPath,
  updateWorkMetadata,
  workForFilename,
} from '../semantic-library.js';

const timestamps = [
  '2026-07-30T10:00:00.000Z',
  '2026-07-30T10:00:01.000Z',
  '2026-07-30T10:00:02.000Z',
  '2026-07-30T10:00:03.000Z',
];
let timestampIndex = 0;
const now = () => timestamps[Math.min(timestampIndex++, timestamps.length - 1)];
let id = 0;
const createId = (kind) => `${kind}_test-${++id}`;

assert.equal(SEMANTIC_SCHEMA_VERSION, 1);
assert.equal(SEMANTIC_CATALOG_PATH, 'catalog/catalog.json');
assert.equal(SEMANTIC_WORKS_PREFIX, 'catalog/works/');
assert.equal(SEMANTIC_ANNOTATIONS_PREFIX, 'annotations/');
assert.equal(legacyBookIdFor('Pride & Prejudice.epub'), 'Pride_Prejudice');

const sidecar = {
  bookId: 'Pride_Prejudice',
  sourceFilename: 'Pride & Prejudice.epub',
  title: 'Pride and Prejudice',
  author: 'Jane Austen',
  position: { fraction: 0.42 },
  bookmarks: [{ label: 'Netherfield', pos: { fraction: 0.2 } }],
  note: 'A legacy note that must remain in its sidecar.',
};
const first = reconcileSemanticLibrary({
  sourceFilenames: ['Pride & Prejudice.epub', 'Notes.txt'],
  sidecars: [sidecar],
  now,
  createId,
});

assert.equal(first.manifests.length, 2, 'each ungrouped source starts as one work');
assert.equal(first.changedManifests.length, 2, 'new manifests are persisted');
assert.equal(first.catalog.works.length, 2);
assert.equal(first.catalog.revision, 1);
assert.equal(first.catalog.recordType, 'books.catalog');
assert.equal(first.manifests[0].recordType, 'books.work');
assert.equal(first.manifests[0].title, 'Pride and Prejudice');
assert.deepEqual(first.manifests[0].authors, [{ name: 'Jane Austen', source: 'legacy-sidecar' }]);
assert.equal(first.manifests[0].assets[0].fingerprintStatus, 'pending');
assert.equal(first.manifests[0].assets[0].availability, 'available');
assert.equal(first.manifests[0].legacy.sidecarPath, 'notes/Pride_Prejudice.json');
assert.equal(
  workForFilename(first.catalog, 'Pride & Prejudice.epub').workId,
  first.manifests[0].workId,
);
assert.equal(
  semanticManifestPath(first.manifests[0].workId),
  `catalog/works/${first.manifests[0].workId}.json`,
);

const idAfterFirstMigration = id;
const second = reconcileSemanticLibrary({
  sourceFilenames: ['Pride & Prejudice.epub', 'Notes.txt'],
  sidecars: [sidecar],
  existingManifests: first.manifests,
  existingCatalog: first.catalog,
  now,
  createId,
});
assert.equal(id, idAfterFirstMigration, 'an idempotent migration allocates no new IDs');
assert.equal(second.changedManifests.length, 0, 'an idempotent migration rewrites no manifests');
assert.equal(second.catalogChanged, false, 'an idempotent migration rewrites no catalog');
assert.deepEqual(second.catalog, first.catalog);

const rebuilt = rebuildCatalog(first.manifests, null, now);
assert.equal(rebuilt.changed, true, 'catalog can be reconstructed from portable manifests');
assert.deepEqual(rebuilt.catalog.aliases, first.catalog.aliases);
assert.deepEqual(
  rebuilt.catalog.works.map(({ updatedAt, ...work }) => work),
  first.catalog.works.map(({ updatedAt, ...work }) => work),
);

const missing = reconcileSemanticLibrary({
  sourceFilenames: ['Notes.txt'],
  sidecars: [],
  existingManifests: first.manifests,
  existingCatalog: first.catalog,
  now,
  createId,
});
const missingAsset = missing.manifests
  .flatMap((manifest) => manifest.assets)
  .find((asset) => asset.sourceFilename === 'Pride & Prejudice.epub');
assert.equal(missingAsset.availability, 'missing', 'catalog repair retains missing asset identity');
assert.equal(missing.manifests.length, 2, 'missing originals do not delete portable records');

const metadata = updateWorkMetadata(
  first.manifests[1],
  { bookId: 'Notes', title: 'Field Notes', author: 'A. Researcher' },
  now,
);
assert.equal(metadata.changed, true);
assert.equal(metadata.manifest.title, 'Field Notes');
assert.deepEqual(metadata.manifest.authors, [
  { name: 'A. Researcher', source: 'legacy-sidecar' },
]);

const annotationFirst = reconcileLegacyAnnotations({
  manifest: first.manifests[0],
  sidecars: [sidecar],
  now,
  createId,
});
assert.equal(annotationFirst.changed, true);
assert.equal(annotationFirst.record.recordType, 'books.annotations');
assert.equal(annotationFirst.record.positions.length, 1);
assert.deepEqual(
  annotationFirst.record.positions[0].target.selectors[0].value,
  { fraction: 0.42 },
);
assert.equal(annotationFirst.record.annotations.length, 2);
assert.equal(
  annotationFirst.record.annotations.find((item) => item.kind === 'note').body,
  sidecar.note,
);
assert.equal(
  semanticAnnotationsPath(first.manifests[0].workId),
  `annotations/${first.manifests[0].workId}.json`,
);
const annotationIdAfterFirstMigration = id;
const annotationSecond = reconcileLegacyAnnotations({
  manifest: first.manifests[0],
  sidecars: [sidecar],
  existingRecord: annotationFirst.record,
  now,
  createId,
});
assert.equal(annotationSecond.changed, false, 'annotation migration is idempotent');
assert.equal(id, annotationIdAfterFirstMigration, 'annotation retry allocates no new IDs');
assert.deepEqual(annotationSecond.record, annotationFirst.record);

const noteChanged = reconcileLegacyAnnotations({
  manifest: first.manifests[0],
  sidecars: [{ ...sidecar, note: 'Revised note' }],
  existingRecord: annotationFirst.record,
  now,
  createId,
});
assert.equal(noteChanged.changed, true);
assert.equal(noteChanged.record.revision, 2);
assert.equal(
  noteChanged.record.annotations.find((item) => item.kind === 'note').body,
  'Revised note',
);

console.log('Books semantic-library foundation contract: PASS');
