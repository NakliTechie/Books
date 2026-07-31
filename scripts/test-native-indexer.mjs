import assert from 'node:assert/strict';
import {
  appendFileSync,
  mkdtempSync,
  renameSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const fixture = mkdtempSync(join(tmpdir(), 'books-index-fixture-'));
process.on('exit', () => rmSync(fixture, { recursive:true, force:true }));
const scriptSource = readFileSync(
  new URL('./books-index.py', import.meta.url),
  'utf8',
);
assert.match(scriptSource, /--chat-model/);
assert.match(scriptSource, /evidencePassageIds/);
assert.match(scriptSource, /Do not invent evidence/);
assert.match(scriptSource, /source-grounded-model-classifier/);
writeFileSync(
  join(fixture, 'Feedback.md'),
  '# Feedback\n\nFast feedback changes future behaviour.\n\n' +
    'A durable library preserves evidence and context.',
);
execFileSync(
  'python3',
  [
    new URL('./books-index.py', import.meta.url).pathname,
    fixture,
    '--no-embeddings',
  ],
  { stdio:'pipe' },
);

const inventory = JSON.parse(readFileSync(
  join(fixture, '.books', 'inventory', 'current.json'),
  'utf8',
));
assert.equal(inventory.recordType, 'books.folder-inventory');
assert.equal(inventory.files[0].relativePath, 'Feedback.md');
assert.match(inventory.files[0].fingerprint, /^sha256:[a-f0-9]{64}$/);

const catalog = JSON.parse(readFileSync(
  join(fixture, '.books', 'catalog', 'catalog.json'),
  'utf8',
));
assert.equal(catalog.works.length, 1);
const workId = catalog.works[0].workId;
const ideas = JSON.parse(readFileSync(
  join(fixture, '.books', 'semantic', workId, 'ideas.json'),
  'utf8',
));
const units = JSON.parse(readFileSync(
  join(fixture, '.books', 'semantic', workId, 'units.json'),
  'utf8',
));
assert.equal(ideas.recordType, 'books.idea-records');
assert.ok(ideas.ideas.length > 0);
assert.ok(ideas.ideas.every((idea) => idea.evidence.length));
assert.equal(units.recordType, 'books.semantic-units');
assert.ok(units.units.length > 0);
assert.ok(units.units.every((unit) =>
  unit.evidence.every((row) => row.paragraphId && row.passageId)));

const job = JSON.parse(readFileSync(
  join(fixture, '.books', 'jobs', workId + '.json'),
  'utf8',
));
assert.equal(job.executorClass, 'native');
assert.equal(job.lease, null);
assert.equal(job.stages.passages.status, 'complete');
assert.equal(job.stages.semanticUnits.status, 'complete');
assert.equal(job.stages.echoEmbeddings.status, 'waiting-for-model');
assert.equal(job.stages.echoLinks.status, 'blocked-by-embeddings');
assert.equal(job.stages.embeddings.status, 'waiting-for-model');
assert.equal(job.artifacts.passages.path, `semantic/${workId}/passages.json`);
assert.equal(job.artifacts.lexicalIndex.path, `indexes/works/${workId}.json`);

renameSync(
  join(fixture, 'Feedback.md'),
  join(fixture, 'Renamed Feedback.md'),
);
execFileSync(
  'python3',
  [
    new URL('./books-index.py', import.meta.url).pathname,
    fixture,
    '--no-embeddings',
  ],
  { stdio:'pipe' },
);
const renamedCatalog = JSON.parse(readFileSync(
  join(fixture, '.books', 'catalog', 'catalog.json'),
  'utf8',
));
assert.equal(renamedCatalog.works.length, 1);
assert.equal(renamedCatalog.works[0].workId, workId);
assert.deepEqual(renamedCatalog.works[0].sourceFilenames, ['Renamed Feedback.md']);

renameSync(
  join(fixture, 'Renamed Feedback.md'),
  join(fixture, '.held-feedback.md'),
);
for (let pass = 0; pass < 2; pass++) {
  execFileSync(
    'python3',
    [
      new URL('./books-index.py', import.meta.url).pathname,
      fixture,
      '--no-embeddings',
    ],
    { stdio:'pipe' },
  );
}
renameSync(
  join(fixture, '.held-feedback.md'),
  join(fixture, 'Returned Feedback.md'),
);
execFileSync(
  'python3',
  [
    new URL('./books-index.py', import.meta.url).pathname,
    fixture,
    '--no-embeddings',
  ],
  { stdio:'pipe' },
);
const returnedCatalog = JSON.parse(readFileSync(
  join(fixture, '.books', 'catalog', 'catalog.json'),
  'utf8',
));
assert.equal(
  returnedCatalog.works.length,
  1,
  'a source restored under a new path after an intervening scan is not duplicated',
);
assert.equal(returnedCatalog.works[0].workId, workId);
assert.deepEqual(
  returnedCatalog.works[0].sourceFilenames,
  ['Returned Feedback.md'],
);

const jobPath = join(fixture, '.books', 'jobs', workId + '.json');
const leasedJob = JSON.parse(readFileSync(jobPath, 'utf8'));
leasedJob.lease = {
  executorId:'browser:foreign-fixture',
  executorClass:'browser',
  claimedAt:'2099-01-01T00:00:00.000Z',
  renewedAt:'2099-01-01T00:00:00.000Z',
  expiresAt:'2099-01-01T00:15:00.000Z',
};
writeFileSync(jobPath, JSON.stringify(leasedJob));
appendFileSync(
  join(fixture, 'Returned Feedback.md'),
  '\n\nA changed source waits for its active foreign lease.',
);
execFileSync(
  'python3',
  [
    new URL('./books-index.py', import.meta.url).pathname,
    fixture,
    '--no-embeddings',
  ],
  { stdio:'pipe' },
);
assert.equal(
  JSON.parse(readFileSync(jobPath, 'utf8')).lease.executorId,
  'browser:foreign-fixture',
  'the native executor does not steal an active browser lease',
);

const cancelledJob = JSON.parse(readFileSync(jobPath, 'utf8'));
cancelledJob.lease.expiresAt = '2000-01-01T00:00:00.000Z';
cancelledJob.cancelRequested = true;
writeFileSync(jobPath, JSON.stringify(cancelledJob));
execFileSync(
  'python3',
  [
    new URL('./books-index.py', import.meta.url).pathname,
    fixture,
    '--no-embeddings',
  ],
  { stdio:'pipe' },
);
assert.equal(
  JSON.parse(readFileSync(jobPath, 'utf8')).cancelRequested,
  true,
  'the native executor honours a durable cancellation request',
);
execFileSync(
  'python3',
  [
    new URL('./books-index.py', import.meta.url).pathname,
    fixture,
    '--no-embeddings',
    '--force',
  ],
  { stdio:'pipe' },
);
const resumedJob = JSON.parse(readFileSync(jobPath, 'utf8'));
assert.equal(resumedJob.cancelRequested, false);
assert.equal(resumedJob.lease, null);
assert.equal(resumedJob.stages.passages.status, 'complete');

writeFileSync(
  join(fixture, '.books', 'inventory', 'current.json'),
  '{"recordType":"books.folder-inventory","completed":',
);
execFileSync(
  'python3',
  [
    new URL('./books-index.py', import.meta.url).pathname,
    fixture,
    '--no-embeddings',
  ],
  { stdio:'pipe' },
);
const recoveredInventory = JSON.parse(readFileSync(
  join(fixture, '.books', 'inventory', 'current.json'),
  'utf8',
));
assert.equal(
  recoveredInventory.generation,
  9,
  'a partial current inventory recovers from the latest completed generation',
);
assert.equal(recoveredInventory.counts.unstable, 0);
assert.equal(recoveredInventory.counts.collisions, 0);

console.log('Books native indexer contract: PASS');
