import assert from 'node:assert/strict';
import {
  FOLDER_SIDECAR_DIRECTORY,
  makeFolderInventoryRecord,
  makeFolderLibraryManifest,
  normaliseFolderRelativePath,
  reconcileFolderInventory,
  renameCandidates,
  shouldSkipFolderEntry,
} from '../folder-library.js';

assert.equal(normaliseFolderRelativePath('Fiction\\Dune.epub'), 'Fiction/Dune.epub');
assert.throws(() => normaliseFolderRelativePath('../Dune.epub'));
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
