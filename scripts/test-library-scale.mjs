import assert from 'node:assert/strict';
import {
  buildLibraryIdeaGraph,
} from '../idea-graph.js';
import { buildEchoGraph } from '../echoes.js';
import {
  makeFolderInventoryRecord,
  reconcileFolderInventory,
} from '../folder-library.js';

const fileCount = 10_000;
const previousFiles = Array.from({ length:fileCount }, (_, index) =>
  makeFolderInventoryRecord({
    relativePath:`Shelf ${Math.floor(index / 100)}/Book ${index}.epub`,
    byteLength:10_000 + index,
    lastModified:1_000 + index,
    format:'epub',
    fingerprint:`sha256:${String(index).padStart(64, '0')}`,
    lastSeenGeneration:4,
  }));
const observed = previousFiles.map((row) => ({
  relativePath:row.relativePath,
  byteLength:row.byteLength,
  lastModified:row.lastModified,
  format:row.format,
}));
observed[5_000] = {
  ...observed[5_000],
  byteLength:observed[5_000].byteLength + 1,
};
const inventoryStarted = performance.now();
const reconciliation = reconcileFolderInventory({
  previous:{ generation:4, files:previousFiles },
  observed,
});
const inventoryElapsed = performance.now() - inventoryStarted;
assert.equal(reconciliation.inventory.counts.total, fileCount);
assert.equal(reconciliation.inventory.counts.changed, 1);
assert.equal(reconciliation.inventory.counts.unchanged, fileCount - 1);
assert.ok(inventoryElapsed < 5_000, `10k inventory took ${inventoryElapsed} ms`);

const ideaCount = 3_000;
const ideas = Array.from({ length:ideaCount }, (_, index) => ({
  ideaId:`idea-${index}`,
  workId:`work-${index}`,
  label:index % 2 ? 'Feedback' : 'Systems',
  statement:'Fast feedback changes future behaviour.',
  evidence:[{ passageId:`passage-${index}` }],
}));
const vectors = new Map(ideas.map((idea, index) => [
  idea.ideaId,
  Array.from({ length:16 }, (_, dimension) =>
    ((index % 2 ? 1 : -1) * (dimension + 1)) / 100),
]));
const graphStarted = performance.now();
const graph = buildLibraryIdeaGraph({
  ideas,
  vectors,
  model:'fixture',
  dimensions:16,
  minScore:0.95,
  topK:2,
});
const graphElapsed = performance.now() - graphStarted;
assert.equal(graph.candidateStrategy, 'multi-table-signature-v1');
assert.ok(graph.links.length > 0);
assert.ok(graph.links.length <= ideaCount * 2);
assert.ok(graphElapsed < 8_000, `3k idea graph took ${graphElapsed} ms`);

const units = ideas.map((idea, index) => ({
  unitId:`unit-${index}`,
  workId:idea.workId,
  label:idea.label,
  statement:idea.statement,
  kind:'topic',
  lens:'expository',
  confidence:0.7,
  evidence:[{
    passageId:`passage-${index}`,
    paragraphId:`paragraph-${index}`,
    textHash:`sha256:text-${index}`,
  }],
  userState:{ hidden:false },
}));
const unitVectors = new Map(units.map((unit, index) => [
  unit.unitId,
  vectors.get(`idea-${index}`),
]));
const echoStarted = performance.now();
const echoGraph = buildEchoGraph({
  units,
  vectors:unitVectors,
  model:'fixture',
  dimensions:16,
  minScore:0.95,
  topK:2,
});
const echoElapsed = performance.now() - echoStarted;
assert.equal(echoGraph.candidateStrategy, 'multi-table-signature-v1');
assert.equal(echoGraph.compatibilityStrategy, 'typed-units-v1');
assert.ok(echoGraph.links.length > 0);
assert.ok(echoGraph.links.length <= ideaCount * 2);
assert.ok(echoElapsed < 8_000, `3k Echo graph took ${echoElapsed} ms`);

console.log(
  `Books scale contract: PASS (${Math.round(inventoryElapsed)} ms inventory, ` +
  `${Math.round(graphElapsed)} ms graph, ${Math.round(echoElapsed)} ms Echo graph)`,
);
