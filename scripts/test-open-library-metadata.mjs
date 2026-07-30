import assert from 'node:assert/strict';
import {
  applyOpenLibrarySuggestion,
  findIsbn,
  lookupOpenLibraryMetadata,
  manifestIsbn,
  normalizeIsbn,
  openLibrarySearchUrl,
  selectOpenLibraryCover,
} from '../open-library-metadata.js';

assert.equal(normalizeIsbn('978-0-306-40615-7'), '9780306406157');
assert.equal(normalizeIsbn('0-306-40615-2'), '0306406152');
assert.equal(normalizeIsbn('9780306406158'), null);
assert.equal(
  findIsbn('Questions -- isbn13 9780062844767 -- archive.epub'),
  '9780062844767',
);
assert.match(
  openLibrarySearchUrl({ isbn:'9780306406157' }),
  /isbn=9780306406157/,
);
assert.match(
  openLibrarySearchUrl({ title:'Pride and Prejudice', authors:['Jane Austen'] }),
  /title=Pride\+and\+Prejudice/,
);

const response = await lookupOpenLibraryMetadata({
  isbn:'9780306406157',
  now:() => '2026-07-31T00:00:00.000Z',
  minIntervalMs:0,
  cache:new Map(),
  fetchImpl:async (url, options) => {
    assert.match(url, /openlibrary\.org\/search\.json/);
    assert.equal(options.credentials, 'omit');
    return {
      ok:true,
      async json() {
        return {
          docs:[{
            key:'/works/OL123W',
            title:'Fixture Book',
            author_name:['A. Author'],
            first_publish_year:2026,
            publisher:['Fixture Press'],
            language:['eng'],
            isbn:['9780306406157'],
            cover_i:1234,
          }],
        };
      },
    };
  },
});
assert.equal(response.candidates.length, 1);
assert.equal(response.candidates[0].matchedBy.type, 'isbn-13');
assert.equal(response.candidates[0].cover.coverId, 1234);

let cachedFetches = 0;
const lookupCache = new Map();
const cachedOptions = {
  isbn:'9780062844767',
  minIntervalMs:0,
  cache:lookupCache,
  fetchImpl:async () => {
    cachedFetches += 1;
    return {
      ok:true,
      async json() {
        return { docs:[{
          key:'/works/OL456W',
          title:'Cached Fixture',
          isbn:['9780062844767'],
        }] };
      },
    };
  },
};
await lookupOpenLibraryMetadata(cachedOptions);
await lookupOpenLibraryMetadata(cachedOptions);
assert.equal(cachedFetches, 1, 'identical lookups share a bounded session cache');

const manifest = {
  workId:'work-fixture',
  title:'Fixture filename',
  authors:[],
  metadataProvenance:{ title:'filename', authors:null },
  editions:[{
    editionId:'edition-fixture',
    identifiers:{},
    createdAt:'2026-07-30T00:00:00.000Z',
    updatedAt:'2026-07-30T00:00:00.000Z',
  }],
  assets:[{ sourceFilename:'Fixture filename.epub' }],
  createdAt:'2026-07-30T00:00:00.000Z',
  updatedAt:'2026-07-30T00:00:00.000Z',
};
const applied = applyOpenLibrarySuggestion(
  manifest,
  response.candidates[0],
  () => '2026-07-31T00:00:00.000Z',
);
assert.equal(applied.changed, true);
assert.equal(applied.manifest.title, 'Fixture Book');
assert.deepEqual(
  applied.manifest.authors,
  [{ name:'A. Author', source:'open-library' }],
);
assert.equal(
  applied.manifest.editions[0].identifiers['isbn-13'][0],
  '9780306406157',
);
assert.equal(applied.manifest.editions[0].publisher, 'Fixture Press');
assert.equal(manifestIsbn(applied.manifest), '9780306406157');
assert.equal(applied.manifest.metadataSources[0].provider, 'open-library');

const protectedManifest = structuredClone(manifest);
protectedManifest.title = 'My title';
protectedManifest.authors = [{ name:'My Author', source:'user' }];
protectedManifest.metadataProvenance = { title:'user', authors:'user' };
const protectedResult = applyOpenLibrarySuggestion(
  protectedManifest,
  response.candidates[0],
);
assert.equal(protectedResult.manifest.title, 'My title');
assert.deepEqual(protectedResult.manifest.authors, protectedManifest.authors);

const covered = selectOpenLibraryCover(
  applied.manifest,
  response.candidates[0],
  {
    path:'covers/work-fixture-open-library-1234.cover',
    mimeType:'image/jpeg',
    byteLength:2048,
  },
  () => '2026-07-31T00:01:00.000Z',
);
assert.equal(covered.changed, true);
assert.equal(covered.manifest.selectedCover.coverId, 1234);
assert.equal(covered.manifest.selectedCover.byteLength, 2048);

console.log('Books Open Library metadata contract: PASS');
