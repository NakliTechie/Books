#!/usr/bin/env node

import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import {
  buildLibraryReport,
  formatLibraryReport,
} from '../library-report.js';
import {
  buildEchoQualityReport,
  buildEchoReviewQueue,
} from '../echo-review.js';

function parseArgs(argv) {
  const values = argv.slice(2);
  const json = values.includes('--json');
  const positional = values.filter((value) => !value.startsWith('--'));
  if (positional.length !== 1) {
    throw new Error('Usage: npm run report -- /path/to/library [--json]');
  }
  return { folder:resolve(positional[0]), json };
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,240}$/;

async function assertSafeSidecar(sidecar) {
  const sidecarInfo = await lstat(sidecar).catch(() => null);
  if (sidecarInfo?.isSymbolicLink()) {
    throw new Error('Refusing a symlinked .books sidecar');
  }
  if (!sidecarInfo?.isDirectory()) {
    throw new Error(`No Books sidecar found at ${sidecar}`);
  }
  const root = await realpath(sidecar);
  const pending = [sidecar];
  while (pending.length) {
    const directory = pending.pop();
    const entries = await readdir(directory, { withFileTypes:true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        throw new Error(`Refusing a symlink inside .books: ${entry.name}`);
      }
      if (entry.isDirectory()) pending.push(resolve(directory, entry.name));
    }
  }
  if (await realpath(sidecar) !== root) {
    throw new Error('The .books sidecar changed while it was being inspected');
  }
}

async function readValidatedRecordDirectory(path, recordType = null) {
  let names = [];
  try {
    names = await readdir(path);
  } catch {
    return [];
  }
  const records = await Promise.all(
    names
      .filter((name) => name.endsWith('.json') && SAFE_ID.test(name.slice(0, -5)))
      .sort()
      .map(async (name) => {
        const workId = name.slice(0, -5);
        const record = await readJson(resolve(path, name));
        if (!record || record.workId !== workId) return null;
        if (recordType && record.recordType !== recordType) return null;
        return record;
      }),
  );
  return records.filter(Boolean);
}

async function readSemanticRecords(sidecar, workIds, filename) {
  const records = await Promise.all(
    workIds
      .filter((workId) => SAFE_ID.test(workId))
      .map((workId) =>
        readJson(resolve(sidecar, 'semantic', workId, filename))),
  );
  return records.filter((record) =>
    record && SAFE_ID.test(record.workId) && workIds.includes(record.workId));
}

const { folder, json } = parseArgs(process.argv);
const sidecar = basename(folder) === '.books' ? folder : resolve(folder, '.books');
await assertSafeSidecar(sidecar);
const [
  library,
  inventory,
  catalog,
  manifests,
  jobs,
  graph,
  echoGraph,
  echoReviewQueue,
  echoEvaluations,
  echoCuration,
] = await Promise.all([
  readJson(resolve(sidecar, 'library.json')),
  readJson(resolve(sidecar, 'inventory', 'current.json')),
  readJson(resolve(sidecar, 'catalog', 'catalog.json')),
  readValidatedRecordDirectory(resolve(sidecar, 'catalog', 'works'), 'books.work'),
  readValidatedRecordDirectory(resolve(sidecar, 'jobs')),
  readJson(resolve(sidecar, 'indexes', 'library-idea-graph.json')),
  readJson(resolve(sidecar, 'indexes', 'library-echo-graph.json')),
  readJson(resolve(sidecar, 'indexes', 'echo-review-queue.json')),
  readJson(resolve(sidecar, 'annotations', 'echo-evaluations.json')),
  readJson(resolve(sidecar, 'annotations', 'echoes.json')),
]);
if (!library && !inventory && !catalog) {
  throw new Error(`No Books sidecar found at ${sidecar}`);
}
const workIds = Array.from(new Set([
  ...manifests.map((manifest) => manifest.workId),
  ...(catalog?.works || []).map((work) => work.workId),
])).filter(Boolean);
const [passages, semantics, ideas, semanticUnits, readerConnections] = await Promise.all([
  readSemanticRecords(sidecar, workIds, 'passages.json'),
  readSemanticRecords(sidecar, workIds, 'records.json'),
  readSemanticRecords(sidecar, workIds, 'ideas.json'),
  readSemanticRecords(sidecar, workIds, 'units.json'),
  readSemanticRecords(sidecar, workIds, 'reader-connections.json'),
]);
const effectiveEchoReviewQueue = echoReviewQueue || (
  echoGraph
    ? buildEchoReviewQueue({
        graph:echoGraph,
        units:semanticUnits.flatMap((record) => record.units || []),
        manifests,
        curation:echoCuration,
      })
    : null
);
const report = buildLibraryReport({
  library,
  inventory,
  catalog,
  manifests,
  jobs,
  passages,
  semantics,
  ideas,
  graph,
  semanticUnits,
  echoGraph,
  readerConnections,
  echoQuality:effectiveEchoReviewQueue
    ? buildEchoQualityReport(effectiveEchoReviewQueue, echoEvaluations)
    : null,
});
process.stdout.write(json
  ? JSON.stringify(report, null, 2) + '\n'
  : formatLibraryReport(report));
