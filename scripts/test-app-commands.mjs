// Read commands for other NakliOS apps: each handler runs against a fixture library, results keep their
// shape and stay under the host's 256 KB cap, and the registered set equals commands.json.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMMAND_DEFINITIONS,
  createLibraryCommands,
  fitToBudget,
  PASSAGE_MAX_CHARS,
  RESULT_BUDGET_BYTES,
} from '../app-commands.js';
import { buildLexicalIndex } from '../semantic-processing.js';

const HOST_CAP = 262144;
const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;

function makePassages(workId, texts, anchor = () => ({})) {
  return texts.map((text, order) => ({
    passageId:`passage_${workId}_${order}`,
    workId,
    order,
    text,
    structure:{ sectionIndex:Math.floor(order / 2), label:`Chapter ${Math.floor(order / 2) + 1}` },
    anchor:{ engine:anchor(order) },
  }));
}

const works = [
  { workId:'work_walden', title:'Walden', authors:['Henry David Thoreau'], formats:['epub'] },
  { workId:'work_origin', title:'On the Origin of Species', authors:['Charles Darwin'], formats:['pdf'] },
  { workId:'work_empty', title:'Unprocessed Book', authors:[], formats:['txt'] },
];
const passages = {
  work_walden:makePassages('work_walden', [
    'I went to the woods because I wished to live deliberately.',
    'Simplicity, simplicity, simplicity! I say, let your affairs be as two or three.',
    'The mass of men lead lives of quiet desperation.',
    'Heaven is under our feet as well as over our heads.',
  ], (order) => ({ kind:'foliate-section', cfi:`epubcfi(/6/${order * 2 + 2})`, sectionIndex:order })),
  work_origin:makePassages('work_origin', [
    'Natural selection acts only by the preservation of profitable modifications.',
    'The woods and the struggle for existence among plants.',
    'x'.repeat(30000),
  ], (order) => ({ kind:'pdf-page', page:order + 10 })),
};
const indexes = Object.fromEntries(Object.entries(passages).map(([workId, rows]) => [
  workId,
  buildLexicalIndex({ workId, title:works.find((w) => w.workId === workId).title, passages:rows }),
]));
const annotationRecords = {
  work_walden:{ annotations:[
    { annotationId:'annotation_1', kind:'highlight', color:'yellow', label:'', body:'Key line',
      target:{ exact:'live deliberately', passageId:'passage_work_walden_0' },
      createdAt:'2026-11-01T00:00:00Z', updatedAt:'2026-11-01T00:00:00Z', deletedAt:null },
    { annotationId:'annotation_2', kind:'note', body:'Deleted', target:{}, updatedAt:'2026-11-02T00:00:00Z',
      deletedAt:'2026-11-03T00:00:00Z' },
  ] },
};

let semanticCalls = 0;
const opened = [];
const deps = {
  openPassage:async ({ work, passage, passageCount }) => { opened.push([work.workId, passage.passageId, passageCount]); },
  listWorks:async () => works,
  readPassages:async (workId) => (passages[workId] ? { passages:passages[workId] } : null),
  readLexicalIndex:async (workId) => indexes[workId] || null,
  readAnnotations:async (workId) => annotationRecords[workId] || null,
  semanticSearch:async () => {
    semanticCalls += 1;
    return [{ workId:'work_walden', passageId:'passage_work_walden_3', score:0.95, label:'Heaven underfoot' }];
  },
};
const commands = createLibraryCommands(deps);
const call = (name, args, context = {}) => commands.find((c) => c.name === name).handler(args, context);

// The registered set, the definitions and commands.json agree.
const manifest = JSON.parse(readFileSync(new URL('../commands.json', import.meta.url), 'utf8'));
assert.deepEqual(manifest.commands, COMMAND_DEFINITIONS, 'commands.json equals COMMAND_DEFINITIONS');
assert.deepEqual(commands.map((c) => c.name), manifest.commands.map((c) => c.name));
const NAME = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*){0,3}$/;
for (const command of commands) {
  assert.equal(typeof command.handler, 'function', command.name + ' has a handler');
  assert.equal(command.scope, 'read', command.name + ' only reads');
  assert.match(command.name, NAME);
  assert.equal(command.input.type, 'object');
  assert.ok(command.description.trim());
}
// The host's parity check needs each name as a literal in a mirrored file.
const moduleSource = readFileSync(new URL('../app-commands.js', import.meta.url), 'utf8');
for (const { name } of manifest.commands) assert.ok(moduleSource.includes(`'${name}'`));
const appSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(appSource, /import \{ createLibraryCommands \} from '\.\/app-commands\.js';/);
const bootBody = appSource.slice(appSource.indexOf('function boot() {'), appSource.indexOf('function boot() {') + 600);
assert.ok(bootBody.includes('if (naklios.capabilities.hosted) void registerLibraryCommands();'), 'boot registers the commands when hosted');

// library.list
const listed = await call('library.list', {});
assert.equal(listed.total, 3);
assert.deepEqual(listed.works.map((w) => w.title), ['On the Origin of Species', 'Unprocessed Book', 'Walden']);
assert.deepEqual(Object.keys(listed.works[0]), ['workId', 'title', 'authors', 'formats']);
assert.deepEqual((await call('library.list', { offset:1, limit:1 })).works.map((w) => w.workId), ['work_empty']);
assert.deepEqual((await call('library.list', { query:'darwin' })).works.map((w) => w.workId), ['work_origin']);

// library.search: keyword hits across works, plus meaning hits, deduplicated
const found = await call('library.search', { query:'woods' });
assert.equal(found.searchedWorks, 3);
assert.equal(found.indexedWorks, 2);
assert.equal(found.semantic, true);
const ids = found.hits.map((hit) => hit.location.passageId);
assert.ok(ids.includes('passage_work_walden_0'));
assert.ok(ids.includes('passage_work_origin_1'));
assert.ok(ids.includes('passage_work_walden_3'), 'meaning hit included');
assert.equal(new Set(ids).size, ids.length, 'no duplicate hits');
const walden = found.hits.find((hit) => hit.location.passageId === 'passage_work_walden_0');
assert.equal(walden.title, 'Walden');
assert.equal(walden.match, 'keyword');
assert.equal(walden.location.chapter, 'Chapter 1');
assert.equal(walden.location.cfi, 'epubcfi(/6/2)');
assert.match(walden.excerpt, /woods/);
const origin = found.hits.find((hit) => hit.location.passageId === 'passage_work_origin_1');
assert.equal(origin.location.page, 11);
assert.equal(found.hits.find((h) => h.match === 'meaning').idea, 'Heaven underfoot');
const scoped = await call('library.search', { query:'woods', workId:'work_origin', limit:1 });
assert.equal(scoped.hits.length, 1);
assert.equal(scoped.hits[0].workId, 'work_origin');
await assert.rejects(call('library.search', { query:'w' }), /at least 2/);
await assert.rejects(call('library.search', { query:'woods', workId:'nope' }), /No work/);

// passage.get: bounded text, neighbours, citation
const got = await call('passage.get', { workId:'work_walden', passageId:'passage_work_walden_1', context:1 });
assert.match(got.text, /Simplicity/);
assert.equal(got.before[0].passageId, 'passage_work_walden_0');
assert.equal(got.after[0].passageId, 'passage_work_walden_2');
assert.deepEqual(got.citation, { title:'Walden', authors:['Henry David Thoreau'], chapter:'Chapter 1', page:null });
const big = await call('passage.get', { workId:'work_origin', passageId:'passage_work_origin_2', maxChars:99999, context:3 });
assert.equal(big.text.length, PASSAGE_MAX_CHARS);
assert.equal(big.truncated, true);
assert.equal(big.citation.page, 12);
assert.deepEqual(big.before, [], 'no budget left for neighbours');
const small = await call('passage.get', { workId:'work_origin', passageId:'passage_work_origin_2' });
assert.equal(small.text.length, 4000);
await assert.rejects(call('passage.get', { workId:'work_walden', passageId:'missing' }), /No passage/);
await assert.rejects(call('passage.get', { workId:'missing', passageId:'x' }), /No work/);

// annotation.list: deleted annotations are left out
const notes = await call('annotation.list', {});
assert.equal(notes.total, 1);
assert.equal(notes.annotations[0].quote, 'live deliberately');
assert.equal(notes.annotations[0].title, 'Walden');
assert.equal((await call('annotation.list', { workId:'work_origin' })).total, 0);

// reader.open: checks the ids, opens the reader at the passage, and is the only command that shows the window
const shown = await call('reader.open', { workId:'work_origin', passageId:'passage_work_origin_1' });
assert.deepEqual(opened, [['work_origin', 'passage_work_origin_1', 3]]);
assert.equal(shown.opened, true);
assert.equal(shown.location.page, 11);
await assert.rejects(call('reader.open', { workId:'work_origin', passageId:'missing' }), /No passage/);
await assert.rejects(call('reader.open', { workId:'missing', passageId:'x' }), /No work/);
assert.equal(opened.length, 1, 'a refused call opens nothing');
assert.deepEqual(COMMAND_DEFINITIONS.filter((c) => c.shows).map((c) => c.name), ['reader.open']);
const noReader = createLibraryCommands({ ...deps, openPassage:undefined });
await assert.rejects(noReader.find((c) => c.name === 'reader.open').handler({ workId:'work_origin', passageId:'passage_work_origin_1' }), /unavailable/);

// abort: a stopped caller ends the work
const controller = new AbortController();
controller.abort();
await assert.rejects(call('library.search', { query:'woods' }, { signal:controller.signal }), /stopped waiting/);

// size cap: a huge library still answers under the host cap
const manyWorks = Array.from({ length:5000 }, (_, i) => ({
  workId:`work_${i}`, title:'T'.repeat(200) + i, authors:['A'.repeat(200)], formats:['epub'],
}));
const huge = createLibraryCommands({ ...deps, listWorks:async () => manyWorks });
const hugeList = await huge.find((c) => c.name === 'library.list').handler({ limit:200 });
assert.ok(bytes(hugeList) <= HOST_CAP);
const fitted = fitToBudget({ rows:Array.from({ length:2000 }, () => 'y'.repeat(500)) }, 'rows');
assert.equal(fitted.truncated, true);
assert.ok(bytes(fitted) <= RESULT_BUDGET_BYTES);
for (const result of [listed, found, got, big, notes]) assert.ok(bytes(result) <= HOST_CAP);
assert.ok(semanticCalls >= 1);

console.log('app commands: 5 read commands, manifest parity, shapes, 256 KB cap and abort: PASS');
