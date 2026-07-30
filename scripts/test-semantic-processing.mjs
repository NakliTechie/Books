import assert from 'node:assert/strict';
import {
  buildLexicalIndex,
  extractDeterministicSemantics,
  makeProcessingRun,
  normalizePassageText,
  passagesPath,
  processingRunPath,
  searchLexicalIndex,
  segmentSections,
  semanticRecordsPath,
  tokenize,
  updateProcessingStage,
  workLexicalIndexPath,
} from '../semantic-processing.js';

assert.equal(normalizePassageText(' One  two\r\n\r\n\r\nThree '), 'One two\n\nThree');
assert.deepEqual(tokenize('Memory, private-library 2026'), [
  'memory',
  'private-library',
  '2026',
]);

const passages = await segmentSections({
  workId: 'work_test',
  assetId: 'asset_test',
  format: 'epub',
  maxChars: 80,
  sections: [
    {
      label: 'Foundations',
      text: 'A private library preserves memory.\n\nSemantic retrieval connects memory to evidence.',
      anchor: { sectionIndex: 0, cfi: 'epubcfi(/6/2)' },
    },
    {
      label: 'Practice',
      text: 'A source-grounded answer cites the passage that supports the answer.',
      anchor: { sectionIndex: 1, cfi: 'epubcfi(/6/4)' },
    },
  ],
});
assert.ok(passages.length >= 2);
assert.equal(passages[0].workId, 'work_test');
assert.equal(passages[0].anchor.format, 'epub');
assert.equal(passages[0].anchor.engine.cfi, 'epubcfi(/6/2)');
assert.match(passages[0].anchor.quoteHash, /^sha256:[a-f0-9]{64}$/);
assert.equal(passages[0].passageId, 'passage_asset_test_0_0_35');

const lexical = buildLexicalIndex({
  workId: 'work_test',
  title: 'Private Memory',
  authors: [{ name: 'N. Reader' }],
  passages,
});
assert.equal(lexical.recordType, 'books.lexical-index');
assert.ok(lexical.postings.memory.length >= 1);
assert.equal(lexical.postings.private.includes(-1), true, 'metadata terms are indexed');
const results = searchLexicalIndex(lexical, 'memory evidence');
assert.ok(results.length >= 1);
assert.equal(
  results[0].passageId,
  passages.find((passage) => passage.text.includes('evidence')).passageId,
);
assert.ok(results[0].score > 0);

const semantics = extractDeterministicSemantics({
  workId: 'work_test',
  passages,
  lexicalIndex: lexical,
});
assert.equal(semantics.recordType, 'books.semantic-records');
assert.ok(semantics.concepts.some((concept) => concept.label === 'memory'));
assert.ok(semantics.concepts.every((concept) => concept.evidence.length > 0));
assert.equal(semantics.scenes.length, 2);
assert.equal(semantics.scenes[0].evidence[0].passageId, passages[0].passageId);

let tick = 0;
const now = () => `2026-07-30T10:00:0${tick++}.000Z`;
const run = makeProcessingRun({
  workId: 'work_test',
  assetId: 'asset_test',
  now,
});
assert.equal(run.stages.passages.status, 'pending');
const completed = updateProcessingStage(
  run,
  'passages',
  'complete',
  { passageCount: passages.length },
  now,
);
assert.equal(completed.stages.passages.status, 'complete');
assert.equal(completed.stages.passages.passageCount, passages.length);
assert.equal(run.stages.passages.status, 'pending', 'stage updates do not mutate prior records');

assert.equal(passagesPath('work_test'), 'semantic/work_test/passages.json');
assert.equal(semanticRecordsPath('work_test'), 'semantic/work_test/records.json');
assert.equal(workLexicalIndexPath('work_test'), 'indexes/works/work_test.json');
assert.equal(processingRunPath('work_test'), 'jobs/work_test.json');

console.log('Books semantic processing contract: PASS');
