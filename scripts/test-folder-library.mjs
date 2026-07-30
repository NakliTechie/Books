import assert from 'node:assert/strict';
import {
  detectFolderPathCollisions,
  FOLDER_SIDECAR_DIRECTORY,
  folderPathCollisionKey,
  makeFolderInventoryRecord,
  makeFolderLibraryManifest,
  normaliseFolderRelativePath,
  reconcileFolderInventory,
  renameCandidates,
  shouldSkipFolderEntry,
} from '../folder-library.js';

assert.equal(normaliseFolderRelativePath('Fiction\\Dune.epub'), 'Fiction/Dune.epub');
assert.throws(() => normaliseFolderRelativePath('../Dune.epub'));
assert.equal(
  folderPathCollisionKey('Fiction/RÉSUMÉ.epub'),
  folderPathCollisionKey('fiction/re\u0301sume\u0301.epub'),
);
assert.deepEqual(detectFolderPathCollisions([
  { relativePath:'Fiction/Book.epub' },
  { relativePath:'fiction/book.epub' },
  { relativePath:'Research/Paper.pdf' },
]), [{
  collisionKey:'fiction/book.epub',
  paths:['Fiction/Book.epub', 'fiction/book.epub'],
}]);
assert.equal(FOLDER_SIDECAR_DIRECTORY, '.books');
assert.equal(shouldSkipFolderEntry({
  name:'.books',
  relativePath:'.books',
  kind:'directory',
}), true);
assert.equal(shouldSkipFolderEntry({
  name:'Fiction',
  relativePath:'Fiction',
  kind:'directory',
}), false);

const manifest = makeFolderLibraryManifest({
  libraryId:'library-fixture',
  rootName:'Fixture',
  now:() => '2026-07-30T00:00:00.000Z',
});
assert.equal(manifest.sourcePolicy, 'read-in-place');
assert.equal(manifest.sidecarDirectory, '.books');

const previous = {
  generation:3,
  files:[
    makeFolderInventoryRecord({
      relativePath:'Fiction/Dune.epub',
      byteLength:100,
      lastModified:10,
      format:'epub',
      fingerprint:'sha256:dune',
      lastSeenGeneration:3,
    }),
    makeFolderInventoryRecord({
      relativePath:'Notes/Old.txt',
      byteLength:20,
      lastModified:5,
      format:'txt',
      fingerprint:'sha256:old',
      lastSeenGeneration:3,
    }),
  ],
};

const reconciled = reconcileFolderInventory({
  previous,
  observed:[
    {
      relativePath:'Fiction/Dune.epub',
      byteLength:100,
      lastModified:10,
      format:'epub',
    },
    {
      relativePath:'Research/New.pdf',
      byteLength:500,
      lastModified:20,
      format:'pdf',
    },
  ],
  now:() => '2026-07-30T00:01:00.000Z',
});

assert.equal(reconciled.inventory.generation, 4);
assert.deepEqual(reconciled.diff.unchanged, ['Fiction/Dune.epub']);
assert.deepEqual(reconciled.diff.added, ['Research/New.pdf']);
assert.equal(
  reconciled.inventory.files.find((row) => row.relativePath === 'Fiction/Dune.epub')
    .fingerprint,
  'sha256:dune',
);
assert.equal(reconciled.inventory.missing[0].relativePath, 'Notes/Old.txt');
assert.equal(reconciled.inventory.counts.collisions, 0);

const withCollision = reconcileFolderInventory({
  observed:[
    {
      relativePath:'Fiction/Book.epub',
      byteLength:10,
      lastModified:1,
      format:'epub',
    },
    {
      relativePath:'fiction/book.epub',
      byteLength:20,
      lastModified:2,
      format:'epub',
    },
  ],
});
assert.equal(withCollision.inventory.counts.collisions, 1);
assert.deepEqual(withCollision.inventory.collisions[0].paths, [
  'Fiction/Book.epub',
  'fiction/book.epub',
]);

const withFingerprint = {
  ...reconciled.inventory,
  files:reconciled.inventory.files.map((record) =>
    record.relativePath === 'Research/New.pdf'
      ? { ...record, fingerprint:'sha256:old', fingerprintStatus:'complete' }
      : record),
};
assert.deepEqual(renameCandidates({ inventory:withFingerprint }), [{
  fingerprint:'sha256:old',
  previousPath:'Notes/Old.txt',
  currentPath:'Research/New.pdf',
}]);

console.log('folder-library tests passed');
