import assert from 'node:assert/strict';
import {
  addPortableAnnotation,
  createPortableBundle,
  curateSemanticConcepts,
  makeLibraryViewsRecord,
  mergeLibraryViewsRecords,
  PORTABLE_BUNDLE_VERSION,
  SEMANTIC_CATALOG_PATH,
  SEMANTIC_ANNOTATIONS_PREFIX,
  SEMANTIC_SCHEMA_VERSION,
  SEMANTIC_VIEWS_PATH,
  SEMANTIC_WORKS_PREFIX,
  legacyBookIdFor,
  markAssetTrashed,
  mergePortableAnnotationRecords,
  mergeWorkManifests,
  reconcileLegacyAnnotations,
  recoverRenamedAssetIdentity,
  reanchorPortableAnnotations,
  reconcileSemanticLibrary,
  rebuildCatalog,
  removeTrashedAsset,
  removeLibraryView,
  restoreTrashedAsset,
  semanticAnnotationsPath,
  semanticManifestPath,
  sha256Fingerprint,
  splitPortableAnnotationRecords,
  splitWorkManifests,
  tombstonePortableAnnotation,
  updateAssetFingerprint,
  updateConceptCuration,
  updatePortableAnnotation,
  updateWorkDetails,
  updateWorkMetadata,
  upsertLibraryView,
  validateLibraryViewsRecord,
  validatePortableBundle,
  validateSemanticLibrary,
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
assert.equal(SEMANTIC_VIEWS_PATH, 'catalog/views.json');
assert.equal(SEMANTIC_WORKS_PREFIX, 'catalog/works/');
assert.equal(SEMANTIC_ANNOTATIONS_PREFIX, 'annotations/');
assert.equal(PORTABLE_BUNDLE_VERSION, 1);
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

const sourceBytes = new TextEncoder().encode('immutable source bytes');
const fingerprint = await sha256Fingerprint(sourceBytes);
assert.match(fingerprint, /^sha256:[a-f0-9]{64}$/);
const fingerprinted = updateAssetFingerprint(
  first.manifests[0],
  first.manifests[0].assets[0].assetId,
  { fingerprint, byteLength: sourceBytes.byteLength },
  now,
);
assert.equal(fingerprinted.changed, true);
assert.equal(fingerprinted.manifest.assets[0].fingerprintStatus, 'complete');
assert.equal(fingerprinted.manifest.assets[0].fingerprint, fingerprint);
assert.equal(fingerprinted.manifest.assets[0].byteLength, sourceBytes.byteLength);
assert.equal(
  updateAssetFingerprint(
    fingerprinted.manifest,
    fingerprinted.manifest.assets[0].assetId,
    { fingerprint, byteLength: sourceBytes.byteLength },
    now,
  ).changed,
  false,
  'repeating the same fingerprint is idempotent',
);
const previouslyMissing = structuredClone(fingerprinted.manifest);
previouslyMissing.assets[0].availability = 'missing';
const renameRecovery = recoverRenamedAssetIdentity(
  previouslyMissing,
  first.manifests[1],
  {
    previousAssetId:previouslyMissing.assets[0].assetId,
    currentFilename:'Renamed Pride.epub',
    fingerprint,
    byteLength:sourceBytes.byteLength,
  },
  now,
);
assert.equal(
  renameRecovery.primary.assets[0].assetId,
  previouslyMissing.assets[0].assetId,
  'a strong-fingerprint rename preserves the original asset identity',
);
assert.equal(renameRecovery.primary.assets[0].sourceFilename, 'Renamed Pride.epub');
assert.equal(renameRecovery.primary.assets[0].availability, 'available');
assert.equal(renameRecovery.tombstone.recordState, 'merged');
assert.equal(renameRecovery.tombstone.mergedInto, previouslyMissing.workId);
assert.equal(
  renameRecovery.tombstone.mergeReason,
  'strong-fingerprint-rename-recovery',
);

const trashed = markAssetTrashed(
  fingerprinted.manifest,
  fingerprinted.manifest.assets[0].assetId,
  { trashId:'trash_test' },
  now,
);
assert.equal(trashed.changed, true);
assert.equal(trashed.manifest.assets[0].availability, 'trashed');
assert.equal(trashed.manifest.assets[0].trash.trashId, 'trash_test');
assert.equal(
  rebuildCatalog([trashed.manifest], null, now).catalog.works[0].assetCount,
  0,
  'trashed originals disappear from the visible rebuildable catalog',
);
const trashedReconcile = reconcileSemanticLibrary({
  sourceFilenames: [],
  existingManifests: [trashed.manifest],
  now,
  createId,
});
assert.equal(
  trashedReconcile.manifests[0].assets[0].availability,
  'trashed',
  'a source scan never degrades an intentional trash state into missing',
);
const restored = restoreTrashedAsset(
  trashed.manifest,
  trashed.manifest.assets[0].assetId,
  { trashId:'trash_test' },
  now,
);
assert.equal(restored.changed, true);
assert.equal(restored.manifest.assets[0].availability, 'available');
assert.equal(restored.manifest.assets[0].trash, undefined);
assert.equal(restored.manifest.assets[0].trashHistory[0].trashId, 'trash_test');
const removed = removeTrashedAsset(
  trashed.manifest,
  trashed.manifest.assets[0].assetId,
  { trashId:'trash_test' },
  now,
);
assert.equal(removed.changed, true);
assert.equal(removed.manifest.assets[0].availability, 'removed');
assert.ok(removed.manifest.assets[0].trashHistory[0].removedAt);

const details = updateWorkDetails(first.manifests[0], {
  title: 'Pride & Prejudice',
  authors: ['Jane Austen'],
  tags: ['classic', 'fiction', 'classic'],
  shelves: ['Favourites'],
  rating: 5,
  isbn: '978-0-306-40615-7',
}, now);
assert.equal(details.changed, true);
assert.equal(details.manifest.title, 'Pride & Prejudice');
assert.deepEqual(details.manifest.authors, [{ name: 'Jane Austen', source: 'user' }]);
assert.deepEqual(details.manifest.userMetadata.tags, ['classic', 'fiction']);
assert.deepEqual(details.manifest.userMetadata.shelves, ['Favourites']);
assert.equal(details.manifest.userMetadata.rating, 5);
assert.equal(
  rebuildCatalog([details.manifest], null, now).catalog.works[0].rating,
  5,
  'the rebuildable catalog projects portable ratings for deterministic facets',
);
assert.equal(details.manifest.metadataProvenance.title, 'user');
assert.equal(details.manifest.metadataProvenance.authors, 'user');
assert.deepEqual(
  details.manifest.editions[0].identifiers['isbn-13'],
  ['9780306406157'],
);
assert.equal(
  details.manifest.editions[0].metadataProvenance.identifiers,
  'user',
);
const protectedUserDetails = updateWorkMetadata(details.manifest, {
  bookId: 'Pride_Prejudice',
  title: 'Stale Sidecar Title',
  author: 'Stale Sidecar Author',
}, now);
assert.equal(protectedUserDetails.manifest.title, 'Pride & Prejudice');
assert.deepEqual(protectedUserDetails.manifest.authors, [
  { name: 'Jane Austen', source: 'user' },
]);
assert.equal(
  updateWorkDetails(details.manifest, {
    title: 'Pride & Prejudice',
    authors: ['Jane Austen'],
    tags: ['fiction', 'classic'],
    shelves: ['Favourites'],
    rating: 5,
  }, now).changed,
  false,
  'repeating normalized work details is idempotent',
);

const conceptFixture = [{
  conceptId:'concept_memory',
  label:'memory',
  evidence:[{ passageId:'passage_1' }],
  userState:{ hidden:false, labelOverride:null },
}, {
  conceptId:'concept_recall',
  label:'recall',
  evidence:[{ passageId:'passage_2' }],
  userState:{ hidden:false, labelOverride:null },
}];
const renamedConcept = updateConceptCuration(details.manifest, 'concept_memory', {
  labelOverride:'Cultural memory',
});
assert.equal(renamedConcept.changed, true);
assert.equal(
  curateSemanticConcepts(conceptFixture, renamedConcept.manifest)[0]
    .userState.labelOverride,
  'Cultural memory',
  'portable concept labels overlay disposable semantic records',
);
const mergedConcept = updateConceptCuration(
  renamedConcept.manifest,
  'concept_recall',
  { mergedInto:'concept_memory' },
);
const visibleMergedConcepts = curateSemanticConcepts(
  conceptFixture,
  mergedConcept.manifest,
);
assert.equal(visibleMergedConcepts.length, 1);
assert.deepEqual(
  visibleMergedConcepts[0].userState.mergedConceptIds,
  ['concept_recall'],
  'portable concept merging leaves one visible target without rewriting evidence',
);
assert.deepEqual(
  visibleMergedConcepts[0].evidence.map((evidence) => evidence.passageId),
  ['passage_1', 'passage_2'],
  'a curated merge presents the union of source-grounded evidence',
);
const restoredConcept = updateConceptCuration(
  mergedConcept.manifest,
  'concept_recall',
  {},
);
assert.equal(
  curateSemanticConcepts(conceptFixture, restoredConcept.manifest).length,
  2,
  'clearing an override splits a concept back to its generated identity',
);
const hiddenConcept = updateConceptCuration(
  renamedConcept.manifest,
  'concept_memory',
  { hidden:true },
);
assert.equal(curateSemanticConcepts(conceptFixture, hiddenConcept.manifest).length, 1);
assert.equal(
  curateSemanticConcepts(
    conceptFixture,
    hiddenConcept.manifest,
    { includeHidden:true },
  ).length,
  2,
  'hidden concepts stay inspectable while remaining absent from normal views',
);

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

const selected = addPortableAnnotation(annotationFirst.record, {
  workId: first.manifests[0].workId,
  kind: 'highlight',
  label: 'A useful sentence',
  color: 'yellow',
  target: {
    passageId: 'passage_test',
    exact: 'It is a truth universally acknowledged',
    normalizedRange: { start: 0, end: 38 },
    engine: { kind: 'native-passage', passageId: 'passage_test' },
  },
}, now, createId);
assert.equal(selected.annotation.kind, 'highlight');
assert.equal(selected.record.annotations.length, annotationFirst.record.annotations.length + 1);
assert.equal(selected.record.revision, annotationFirst.record.revision + 1);
const editedAnnotation = updatePortableAnnotation(
  selected.record,
  selected.annotation.annotationId,
  { body: 'Opening claim', color: 'green', conceptIds: ['concept_claim'] },
  now,
);
assert.equal(editedAnnotation.changed, true);
assert.equal(
  editedAnnotation.record.annotations.find(
    (item) => item.annotationId === selected.annotation.annotationId,
  ).body,
  'Opening claim',
);
const deletedAnnotation = tombstonePortableAnnotation(
  editedAnnotation.record,
  selected.annotation.annotationId,
  now,
);
assert.equal(deletedAnnotation.changed, true);
assert.ok(
  deletedAnnotation.record.annotations.find(
    (item) => item.annotationId === selected.annotation.annotationId,
  ).deletedAt,
  'annotation deletion is a recoverable tombstone',
);
const movedPassages = [{
  passageId:'passage_new',
  text:'Later extraction still contains It is a truth universally acknowledged in context.',
  anchor:{ quoteHash:'sha256:new' },
}];
const reanchored = reanchorPortableAnnotations(selected.record, movedPassages, now);
assert.equal(reanchored.changed, true);
assert.equal(
  reanchored.record.annotations.find(
    (item) => item.annotationId === selected.annotation.annotationId,
  ).target.passageId,
  'passage_new',
);
assert.equal(
  reanchored.record.annotations.find(
    (item) => item.annotationId === selected.annotation.annotationId,
  ).anchorState,
  'resolved',
);
const ambiguous = reanchorPortableAnnotations(selected.record, [
  ...movedPassages,
  { ...movedPassages[0], passageId:'passage_also' },
], now);
assert.equal(
  ambiguous.record.annotations.find(
    (item) => item.annotationId === selected.annotation.annotationId,
  ).anchorState,
  'unresolved',
  'ambiguous matches surface repair instead of silently rebinding',
);
assert.deepEqual(ambiguous.unresolved, [selected.annotation.annotationId]);

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

const sameBytesManifest = structuredClone(first.manifests[1]);
sameBytesManifest.assets[0].fingerprint = fingerprint;
sameBytesManifest.assets[0].fingerprintStatus = 'complete';
sameBytesManifest.assets[0].byteLength = sourceBytes.byteLength;
const catalogValidation = validateSemanticLibrary({
  sourceFilenames: ['Pride & Prejudice.epub', 'Notes.txt', 'Loose.pdf'],
  manifests: [fingerprinted.manifest, sameBytesManifest],
  catalog: first.catalog,
  annotations: [annotationFirst.record],
});
assert.equal(catalogValidation.valid, true);
assert.equal(catalogValidation.catalogNeedsRebuild, true);
assert.deepEqual(
  catalogValidation.exactDuplicates[0].assets.map((asset) => asset.filename).sort(),
  ['Notes.txt', 'Pride & Prejudice.epub'],
  'matching SHA-256 fingerprints are reported as exact duplicates',
);
assert.ok(
  catalogValidation.warnings.some((warning) => warning.code === 'untracked-source'),
  'original files without portable manifests are reported',
);

const editionCandidate = structuredClone(fingerprinted.manifest);
editionCandidate.workId = 'work_candidate';
editionCandidate.title = 'PRIDE—and PREJUDICE';
editionCandidate.authors = [{ name: 'Jane Austen', source: 'user' }];
editionCandidate.assets[0].assetId = 'asset_candidate';
editionCandidate.assets[0].editionId = 'edition_candidate';
editionCandidate.assets[0].sourceFilename = 'Pride and Prejudice.pdf';
editionCandidate.assets[0].format = 'pdf';
editionCandidate.assets[0].fingerprint = 'sha256:different';
editionCandidate.editions[0].editionId = 'edition_candidate';
editionCandidate.editions[0].assetIds = ['asset_candidate'];
const groupingValidation = validateSemanticLibrary({
  sourceFilenames: ['Pride & Prejudice.epub', 'Pride and Prejudice.pdf'],
  manifests: [fingerprinted.manifest, editionCandidate],
});
assert.equal(groupingValidation.groupingSuggestions.length, 1);
assert.equal(groupingValidation.groupingSuggestions[0].confidence, 'likely');
assert.deepEqual(
  groupingValidation.groupingSuggestions[0].works.flatMap((work) => work.formats).sort(),
  ['epub', 'pdf'],
  'matching normalized title and authors suggest user-confirmed format grouping',
);

const grouped = mergeWorkManifests(
  fingerprinted.manifest,
  editionCandidate,
  now,
);
assert.equal(grouped.merged.assets.length, 2);
assert.equal(grouped.merged.editions.length, 2);
assert.equal(grouped.tombstone.recordState, 'merged');
assert.equal(grouped.tombstone.mergedInto, fingerprinted.manifest.workId);
assert.equal(
  grouped.merged.grouping.mergedFrom[0].workId,
  editionCandidate.workId,
);
const groupedCatalog = rebuildCatalog(
  [grouped.merged, grouped.tombstone],
  null,
  now,
).catalog;
assert.equal(groupedCatalog.works.length, 1);
assert.equal(
  workForFilename(groupedCatalog, 'Pride and Prejudice.pdf').workId,
  fingerprinted.manifest.workId,
  'every grouped format resolves to one logical work',
);
const groupedValidationResult = validateSemanticLibrary({
  sourceFilenames:['Pride & Prejudice.epub', 'Pride and Prejudice.pdf'],
  manifests:[grouped.merged, grouped.tombstone],
  catalog:groupedCatalog,
});
assert.equal(groupedValidationResult.valid, true);
assert.equal(groupedValidationResult.summary.works, 1);
assert.equal(groupedValidationResult.summary.assets, 2);
assert.equal(groupedValidationResult.groupingSuggestions.length, 0);
const secondaryAnnotationRecord = {
    ...annotationFirst.record,
    workId:editionCandidate.workId,
    annotations:[{
      annotationId:'annotation_secondary',
      kind:'highlight',
      label:'PDF note',
      target:{ assetId:'asset_candidate' },
    }],
    positions:[{
      positionId:'position_asset_candidate',
      assetId:'asset_candidate',
      target:{ page:7 },
    }],
    preferences:[],
    legacy:{ bookIds:['Pride_Prejudice_PDF'] },
  };
const groupedAnnotations = mergePortableAnnotationRecords(
  annotationFirst.record,
  secondaryAnnotationRecord,
  fingerprinted.manifest.workId,
  now,
);
assert.equal(groupedAnnotations.changed, true);
assert.equal(
  groupedAnnotations.record.annotations.some(
    (annotation) => annotation.annotationId === 'annotation_secondary',
  ),
  true,
  'grouping keeps portable annotations from every format',
);
assert.equal(groupedAnnotations.record.positions.length, 2);
assert.ok(
  groupedAnnotations.record.legacy.groupedAnnotationWorkIds.includes(
    editionCandidate.workId,
  ),
);
const splitAnnotations = splitPortableAnnotationRecords(
  groupedAnnotations.record,
  secondaryAnnotationRecord,
  {
    primaryWorkId:fingerprinted.manifest.workId,
    secondaryWorkId:editionCandidate.workId,
    secondaryAssetIds:['asset_candidate'],
    secondarySourceFilenames:['Pride and Prejudice.pdf'],
  },
  now,
);
assert.equal(
  splitAnnotations.primaryRecord.annotations.some(
    (annotation) => annotation.annotationId === 'annotation_secondary',
  ),
  false,
);
assert.equal(
  splitAnnotations.secondaryRecord.annotations.some(
    (annotation) => annotation.annotationId === 'annotation_secondary',
  ),
  true,
  'splitting moves format-grounded annotations back to their original work',
);
assert.equal(splitAnnotations.primaryRecord.positions.length, 1);
assert.equal(splitAnnotations.secondaryRecord.positions.length, 1);

const split = splitWorkManifests(grouped.merged, grouped.tombstone, now);
assert.deepEqual(
  split.primary.assets.map((asset) => asset.assetId),
  fingerprinted.manifest.assets.map((asset) => asset.assetId),
);
assert.deepEqual(
  split.restored.assets.map((asset) => asset.assetId),
  editionCandidate.assets.map((asset) => asset.assetId),
);
assert.equal(split.restored.recordState, undefined);
assert.equal(
  rebuildCatalog([split.primary, split.restored], null, now).catalog.works.length,
  2,
  'a confirmed grouping can be reversed without changing source identities',
);

const emptyViews = makeLibraryViewsRecord({}, now);
const savedView = upsertLibraryView(emptyViews, {
  name:'Unread favourites',
  query:'history',
  filters:{
    readingState:'unread',
    shelves:['Favourites'],
    tags:['classic'],
  },
  sort:'title',
}, now, createId);
assert.equal(savedView.changed, true);
assert.equal(savedView.record.recordType, 'books.library-views');
assert.equal(savedView.record.views[0].name, 'Unread favourites');
assert.deepEqual(validateLibraryViewsRecord(savedView.record), {
  valid:true,
  errors:[],
});
const removedView = removeLibraryView(
  savedView.record,
  savedView.view.viewId,
  now,
);
assert.equal(removedView.changed, true);
assert.equal(removedView.record.views.length, 0);
const secondSavedView = upsertLibraryView(emptyViews, {
  name:'Annotated',
  query:'',
  filters:{ readingState:'annotated', shelves:[], tags:[] },
  sort:'recent',
}, now, createId);
const mergedViews = mergeLibraryViewsRecords(savedView.record, secondSavedView.record, now);
assert.equal(mergedViews.changed, true);
assert.equal(mergedViews.record.views.length, 2);
const conflictingViews = structuredClone(secondSavedView.record);
conflictingViews.views[0].name = 'Same identity, changed label';
assert.equal(
  mergeLibraryViewsRecords(secondSavedView.record, conflictingViews, now)
    .conflicts.length,
  1,
  'portable saved-view import refuses identity collisions',
);

const portableBundle = createPortableBundle({
  manifests: [fingerprinted.manifest],
  annotations: [annotationFirst.record],
  legacySidecars: [sidecar],
  libraryViews:savedView.record,
  echoCuration:{
    schemaVersion:1,
    recordType:'books.echo-curation',
    connectionFeedback:{},
    linkFeedback:{},
    workExclusions:{},
    updatedAt:'2026-07-30T00:00:00.000Z',
  },
  assets: [{
    filename: 'Pride & Prejudice.epub',
    byteLength: sourceBytes.byteLength,
    fingerprint,
    dataBase64: Buffer.from(sourceBytes).toString('base64'),
  }],
  libraryLabel: 'Test Folder',
  now,
});
assert.equal(portableBundle.recordType, 'books.portable-library');
assert.deepEqual(portableBundle.records.works, [fingerprinted.manifest]);
assert.equal(portableBundle.records.views.views.length, 1);
assert.equal(portableBundle.records.echoCuration.recordType, 'books.echo-curation');
assert.ok(
  portableBundle.omittedRebuildableData.includes('indexes/'),
  'portable bundles explicitly document omitted rebuildable indexes',
);
assert.deepEqual(validatePortableBundle(portableBundle), {
  valid: true,
  errors: [],
  warnings: [],
  summary: {
    works: 1,
    assets: 1,
    annotationRecords: 1,
    legacySidecars: 1,
    savedViews: 1,
    echoCuration: 1,
  },
});
const unsafeBundle = structuredClone(portableBundle);
unsafeBundle.assets[0].filename = '../escape.epub';
assert.equal(validatePortableBundle(unsafeBundle).valid, false);
assert.ok(
  validatePortableBundle(unsafeBundle).errors.some(
    (error) => error.code === 'unsafe-asset-filename',
  ),
  'bundle import rejects paths that could escape the Books library namespace',
);

console.log('Books semantic-library foundation contract: PASS');
