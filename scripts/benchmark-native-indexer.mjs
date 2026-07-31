import assert from 'node:assert/strict';
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const count = Math.max(3, Number(process.argv[2]) || 1_000);
const fixture = mkdtempSync(join(tmpdir(), 'books-index-benchmark-'));
const indexer = new URL('./books-index.py', import.meta.url).pathname;

function runIndexer() {
  const started = performance.now();
  execFileSync(
    'python3',
    [indexer, fixture, '--no-embeddings'],
    { stdio:'pipe' },
  );
  return performance.now() - started;
}

function inventory() {
  return JSON.parse(readFileSync(
    join(fixture, '.books', 'inventory', 'current.json'),
    'utf8',
  ));
}

function catalog() {
  return JSON.parse(readFileSync(
    join(fixture, '.books', 'catalog', 'catalog.json'),
    'utf8',
  ));
}

try {
  for (let index = 0; index < count; index++) {
    const shelf = join(fixture, `Shelf-${Math.floor(index / 100)}`);
    mkdirSync(shelf, { recursive:true });
    writeFileSync(
      join(shelf, `Book-${index}.md`),
      `# Book ${index}\n\nFeedback, evidence, and durable knowledge ` +
        `for fixture ${index}.\n`,
    );
  }
  const coldMs = runIndexer();
  const warmMs = runIndexer();
  assert.equal(inventory().counts.total, count);
  assert.equal(inventory().counts.changed, 0);

  appendFileSync(join(fixture, 'Shelf-0', 'Book-0.md'), '\nChanged once.\n');
  const oneChangeMs = runIndexer();
  assert.equal(inventory().counts.changed, 1);

  const beforeRename = catalog().aliases.sourceFilenames['Shelf-0/Book-1.md'];
  mkdirSync(join(fixture, 'Moved'), { recursive:true });
  renameSync(
    join(fixture, 'Shelf-0', 'Book-1.md'),
    join(fixture, 'Moved', 'Book-1.md'),
  );
  const renameMs = runIndexer();
  assert.equal(inventory().counts.added, 1);
  assert.equal(
    inventory().counts.missing,
    0,
    'a fingerprint-matched move must not leave a missing source behind',
  );
  assert.equal(
    catalog().aliases.sourceFilenames['Moved/Book-1.md'],
    beforeRename,
    'strong fingerprints preserve work identity through a move',
  );

  unlinkSync(join(fixture, 'Shelf-0', 'Book-2.md'));
  const missingMs = runIndexer();
  assert.equal(inventory().counts.missing, 1);
  const missingWork = catalog().works.find((work) =>
    work.sourceFilenames.includes('Shelf-0/Book-2.md'));
  assert.equal(missingWork.availableAssetCount, 0);

  console.log(
    `Books native ${count.toLocaleString()}-book benchmark: ` +
    `${(coldMs / 1000).toFixed(2)}s cold, ${(warmMs / 1000).toFixed(2)}s warm, ` +
    `${(oneChangeMs / 1000).toFixed(2)}s one-change, ` +
    `${(renameMs / 1000).toFixed(2)}s move, ` +
    `${(missingMs / 1000).toFixed(2)}s missing`,
  );
} finally {
  rmSync(fixture, { recursive:true, force:true });
}
