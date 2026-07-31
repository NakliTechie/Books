#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildLibraryReport,
  formatLibraryReport,
} from '../library-report.js';

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

async function readJsonDirectory(path) {
  let names = [];
  try {
    names = await readdir(path);
  } catch {
    return [];
  }
  const records = await Promise.all(
    names
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => readJson(resolve(path, name))),
  );
  return records.filter((record) => record && typeof record === 'object');
}

async function readSemanticRecords(sidecar, workIds, filename) {
  const records = await Promise.all(
    workIds.map((workId) =>
      readJson(resolve(sidecar, 'semantic', workId, filename))),
  );
  return records.filter(Boolean);
}

const { folder, json } = parseArgs(process.argv);
const sidecar = folder.endsWith('/.books') ? folder : resolve(folder, '.books');
const [library, inventory, catalog, manifests, jobs, graph, echoGraph] = await Promise.all([
  readJson(resolve(sidecar, 'library.json')),
  readJson(resolve(sidecar, 'inventory', 'current.json')),
  readJson(resolve(sidecar, 'catalog', 'catalog.json')),
  readJsonDirectory(resolve(sidecar, 'catalog', 'works')),
  readJsonDirectory(resolve(sidecar, 'jobs')),
  readJson(resolve(sidecar, 'indexes', 'library-idea-graph.json')),
  readJson(resolve(sidecar, 'indexes', 'library-echo-graph.json')),
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
});
process.stdout.write(json
  ? JSON.stringify(report, null, 2) + '\n'
  : formatLibraryReport(report));
