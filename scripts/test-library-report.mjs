import assert from 'node:assert/strict';
import {
  buildLibraryReport,
  formatLibraryReport,
  processingOutcome,
} from '../library-report.js';

const completeRun = {
  workId:'work-ready',
  executorClass:'native',
  stages: {
    fingerprint:{ status:'complete' },
    passages:{ status:'complete', passageCount:3 },
    lexicalIndex:{ status:'complete' },
    deterministicSemantics:{ status:'complete', conceptCount:2, sceneCount:1 },
    modelSemantics:{ status:'waiting-for-provider' },
    embeddings:{ status:'waiting-for-model' },
    libraryLinks:{ status:'blocked-by-embeddings' },
  },
};
assert.equal(processingOutcome(completeRun), 'core-complete');
assert.equal(processingOutcome({
  ...completeRun,
  workId:'work-ocr',
  stages:{ ...completeRun.stages, passages:{ status:'waiting-for-ocr' } },
}), 'waiting-for-ocr');

const report = buildLibraryReport({
  generatedAt:'2026-07-30T00:00:00.000Z',
  library:{
    libraryId:'library-fixture',
    rootName:'Fixture',
    schemaVersion:1,
  },
  inventory:{
    generation:4,
    completed:true,
    collisions:[{
      collisionKey:'fiction/book.epub',
      paths:['Fiction/Book.epub', 'fiction/book.epub'],
    }],
    counts:{ total:2 },
  },
  catalog:{
    works:[
      { workId:'work-ready', title:'Ready' },
      { workId:'work-missing', title:'Missing' },
    ],
  },
  manifests:[
    {
      workId:'work-ready',
      title:'Ready',
      assets:[{
        sourceFilename:'Ready.md',
        format:'md',
        availability:'available',
      }],
    },
    {
      workId:'work-missing',
      title:'Missing',
      assets:[{
        sourceFilename:'Missing.epub',
        format:'epub',
        availability:'missing',
      }],
    },
  ],
  jobs:[completeRun],
  passages:[{
    workId:'work-ready',
    passages:[{ passageId:'one' }, { passageId:'two' }, { passageId:'three' }],
  }],
  semantics:[{
    workId:'work-ready',
    concepts:[{ conceptId:'one' }, { conceptId:'two' }],
    scenes:[{ sceneId:'one' }],
  }],
  ideas:[{
    workId:'work-ready',
    ideas:[{ ideaId:'idea-one' }],
  }],
  graph:{
    links:[{
      leftWorkId:'work-ready',
      rightWorkId:'work-missing',
    }],
  },
  semanticUnits:[{
    workId:'work-ready',
    units:[{ unitId:'unit-one' }, { unitId:'unit-two' }],
  }],
  echoGraph:{
    links:[{
      leftWorkId:'work-ready',
      rightWorkId:'work-missing',
    }],
  },
  readerConnections:[{
    workId:'work-ready',
    connections:[{ connectionId:'echo-one' }],
  }],
  echoQuality:{
    graphVersion:'library-echo-links-v2',
    connections:{ reviewed:4, target:20 },
    queries:{ reviewed:2, target:10 },
    calibration:{ currentInlineThreshold:0.82 },
    gate:{ evidenceComplete:true, recommendedDefault:'off' },
  },
});

assert.equal(report.recordType, 'books.library-report');
assert.equal(report.totals.works, 2);
assert.equal(report.totals.availableWorks, 1);
assert.equal(report.totals.passages, 3);
assert.equal(report.totals.concepts, 2);
assert.equal(report.totals.relationships, 1);
assert.equal(report.totals.semanticUnits, 2);
assert.equal(report.totals.echoes, 1);
assert.equal(report.totals.readerConnections, 1);
assert.equal(report.totals.connectionReviews, 4);
assert.equal(report.totals.queryReviews, 2);
assert.equal(report.processingOutcomes['core-complete'], 1);
assert.equal(report.processingOutcomes['not-queued'], 1);
assert.equal(report.issueCounts['path-collision'], 1);
assert.equal(report.issueCounts['no-available-source'], 1);
assert.match(formatLibraryReport(report), /Ready — core-complete/);
assert.match(formatLibraryReport(report), /path-collision: 1/);
assert.match(formatLibraryReport(report), /2 \/ 1 \/ 1/);
assert.match(formatLibraryReport(report), /Connection quality/);
assert.match(formatLibraryReport(report), /Pair review: 4 \/ 20/);

console.log('Books library report contract: PASS');
