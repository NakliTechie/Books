import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const count = Math.max(1, Number(process.argv[2]) || 1_000);
const fixture = mkdtempSync(join(tmpdir(), 'books-index-benchmark-'));

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
  const coldStarted = performance.now();
  execFileSync(
    'python3',
    [
      new URL('./books-index.py', import.meta.url).pathname,
      fixture,
      '--no-embeddings',
    ],
    { stdio:'pipe' },
  );
  const coldMs = performance.now() - coldStarted;
  const warmStarted = performance.now();
  execFileSync(
    'python3',
    [
      new URL('./books-index.py', import.meta.url).pathname,
      fixture,
      '--no-embeddings',
    ],
    { stdio:'pipe' },
  );
  const warmMs = performance.now() - warmStarted;
  const inventory = JSON.parse(readFileSync(
    join(fixture, '.books', 'inventory', 'current.json'),
    'utf8',
  ));
  assert.equal(inventory.counts.total, count);
  assert.equal(inventory.counts.changed, 0);
  console.log(
    `Books native ${count.toLocaleString()}-book benchmark: ` +
    `${(coldMs / 1000).toFixed(2)}s cold, ${(warmMs / 1000).toFixed(2)}s warm`,
  );
} finally {
  rmSync(fixture, { recursive:true, force:true });
}
