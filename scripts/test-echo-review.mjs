import assert from 'node:assert/strict';
import {
  buildEchoQualityReport,
  buildEchoReviewQueue,
  ECHO_EVALUATION_PATH,
  ECHO_QUERY_REVIEW_LABELS,
  ECHO_REVIEW_LABELS,
  ECHO_REVIEW_QUEUE_PATH,
  makeEchoEvaluationRecord,
  mergeEchoEvaluationRecords,
  updateEchoEvaluation,
  updateEchoEvaluationProgress,
  updateEchoQueryEvaluation,
} from '../echo-review.js';

const fixedNow = () => '2026-08-01T12:00:00.000Z';
const unit = (id, workId, lens, kind, label, positionFraction = 0.2) => ({
  unitId:'unit-' + id,
  workId,
  lens,
  kind,
  label,
  statement:label + ' is developed through source-grounded evidence.',
  confidence:0.86,
  evidence:[{
    passageId:'passage-' + id,
    paragraphId:'paragraph-' + id,
    quoteHash:'sha256:' + id,
    textHash:'sha256:text-' + id,
    excerpt:'Evidence for ' + label + ' in ' + workId + '.',
    positionFraction,
  }],
  generatedBy:{ mode:id.includes('model') ? 'model-assisted' : 'deterministic-local' },
});

const units = [
  unit('loss', 'work-a', 'expository', 'mechanism', 'Loss aversion'),
  unit('shop', 'work-b', 'narrative', 'character-choice', 'Refusing to surrender'),
  unit('feedback', 'work-c', 'expository', 'claim', 'Feedback improves performance'),
  unit('reflection', 'work-d', 'expository', 'counterargument', 'Reflection before feedback'),
  unit('letter', 'work-e', 'narrative', 'motif', 'The unopened letter'),
  unit('clock', 'work-f', 'narrative', 'motif', 'The stopped clock'),
  unit('power-a', 'work-g', 'expository', 'concept', 'Power'),
  unit('power-b', 'work-h', 'narrative', 'conflict', 'Power'),
  unit('power-c', 'work-i', 'expository', 'claim', 'Power'),
  unit('power-d', 'work-j', 'narrative', 'theme', 'Power'),
  unit('commitment', 'work-k', 'expository', 'principle', 'Public commitment'),
  unit('ending-model', 'work-l', 'narrative', 'plot-outcome', 'The pact is destroyed', 0.94),
];

const links = [
  ['cross', 'unit-loss', 'unit-shop', 'dramatizes', 0.93],
  ['nonfiction', 'unit-feedback', 'unit-reflection', 'contradicts', 0.89],
  ['fiction', 'unit-letter', 'unit-clock', 'parallels', 0.87],
  ['generic', 'unit-power-a', 'unit-power-b', 'echoes', 0.85],
  ['weak', 'unit-loss', 'unit-feedback', 'echoes', 0.73],
  ['spoiler', 'unit-commitment', 'unit-ending-model', 'tests', 0.92],
  ['hidden', 'unit-power-d', 'unit-clock', 'echoes', 0.84],
].map(([id, leftUnitId, rightUnitId, relation, score]) => {
  const left = units.find((value) => value.unitId === leftUnitId);
  const right = units.find((value) => value.unitId === rightUnitId);
  return {
    linkId:'echo-link-' + id,
    leftUnitId,
    rightUnitId,
    leftWorkId:left.workId,
    rightWorkId:right.workId,
    relation,
    score,
    generatedBy:{ graph:'library-echo-links-v2' },
    ...(relation !== 'echoes' ? {
      classification:{ confidence:score, explanation:'Grounded fixture relation.' },
    } : {}),
  };
});

const graph = {
  recordType:'books.library-echo-graph',
  graphVersion:'library-echo-links-v2',
  links,
  updatedAt:'2026-08-01T11:00:00.000Z',
};
const manifests = units.map((value) => ({
  workId:value.workId,
  title:'Book ' + value.workId.slice(-1).toLocaleUpperCase(),
}));
const curation = {
  recordType:'books.echo-curation',
  linkFeedback:{
    'echo-link-hidden':{ hidden:true, updatedAt:fixedNow() },
  },
};

const queue = buildEchoReviewQueue({
  graph,
  units,
  manifests,
  curation,
  targetPairs:20,
  targetQueries:8,
  now:fixedNow,
});
const sameQueue = buildEchoReviewQueue({
  graph,
  units,
  manifests,
  curation,
  targetPairs:20,
  targetQueries:8,
  now:fixedNow,
});
assert.deepEqual(queue, sameQueue, 'review sampling is deterministic');
assert.equal(queue.recordType, 'books.echo-review-queue');
assert.equal(queue.pairs.length, 6, 'curated links are excluded from review');
assert.ok(queue.queries.length > 0);
assert.ok(queue.pairs.some((row) => row.direction === 'fiction-to-fiction'));
assert.ok(queue.pairs.some((row) => row.direction === 'nonfiction-to-nonfiction'));
assert.ok(queue.pairs.some((row) => row.direction === 'nonfiction-to-fiction'));
assert.ok(queue.pairs.some((row) => row.stratum === 'generic-or-repetitive'));
assert.ok(queue.pairs.some((row) => row.stratum === 'likely-false-positive'));
assert.ok(queue.pairs.some((row) => row.stratum === 'spoiler-sensitive'));
assert.equal(ECHO_REVIEW_QUEUE_PATH, 'indexes/echo-review-queue.json');
assert.equal(ECHO_EVALUATION_PATH, 'annotations/echo-evaluations.json');
assert.ok(ECHO_REVIEW_LABELS.includes('useful'));
assert.ok(ECHO_QUERY_REVIEW_LABELS.includes('poor'));

let evaluations = makeEchoEvaluationRecord({}, fixedNow);
const useful = queue.pairs.find((row) => row.linkId === 'echo-link-cross');
const wrong = queue.pairs.find((row) => row.linkId === 'echo-link-weak');
useful.classification.provider = 'browser-local';
useful.classification.model = 'fixture-model';
useful.generatedBy.relationMethod = 'source-grounded-classifier';
evaluations = updateEchoEvaluation(
  evaluations,
  useful,
  { label:'useful', evidenceValid:true, suggestedRelation:'dramatizes' },
  fixedNow,
);
evaluations = updateEchoEvaluation(
  evaluations,
  wrong,
  { label:'wrong', evidenceValid:false, notes:'Vocabulary dominates the pair.' },
  fixedNow,
);
evaluations = updateEchoQueryEvaluation(
  evaluations,
  queue.queries[0],
  { label:'good', relevantAt1:true, relevantAt3:true },
  fixedNow,
);
assert.equal(Object.keys(evaluations.connectionJudgments).length, 2);
assert.equal(
  evaluations.connectionJudgments[useful.reviewId].provenance.route,
  'model-assisted',
);
assert.equal(
  evaluations.connectionJudgments[wrong.reviewId].surface,
  'connections-review',
);
assert.doesNotMatch(
  JSON.stringify(evaluations),
  /Evidence for/,
  'portable evaluations retain hashes and IDs rather than source excerpts',
);
const sanitized = makeEchoEvaluationRecord({
  connectionJudgments:{
    [useful.reviewId]:{
      ...evaluations.connectionJudgments[useful.reviewId],
      excerpt:'The whole source passage must not survive normalization.',
      notes:'n'.repeat(2000),
    },
    '../unsafe':{ label:'useful', linkId:'echo-link-cross' },
  },
  queryJudgments:{},
}, fixedNow);
assert.equal(Object.keys(sanitized.connectionJudgments).length, 1);
assert.equal(
  sanitized.connectionJudgments[useful.reviewId].notes.length,
  1200,
);
assert.doesNotMatch(JSON.stringify(sanitized), /whole source passage/);
const progressed = updateEchoEvaluationProgress(
  sanitized,
  { connectionReviewId:wrong.reviewId, queryId:queue.queries[0].queryId },
  fixedNow,
);
assert.equal(progressed.progress.connectionReviewId, wrong.reviewId);
assert.equal(progressed.progress.queryId, queue.queries[0].queryId);

const newer = updateEchoEvaluation(
  evaluations,
  wrong,
  { label:'repetitive', evidenceValid:true },
  () => '2026-08-01T12:01:00.000Z',
);
const merged = mergeEchoEvaluationRecords(evaluations, newer);
assert.equal(merged.connectionJudgments[wrong.reviewId].label, 'repetitive');

const report = buildEchoQualityReport(queue, evaluations, {
  targetPairReviews:6,
  targetQueryReviews:1,
  now:fixedNow,
});
assert.equal(report.recordType, 'books.echo-quality-report');
assert.equal(report.connections.reviewed, 2);
assert.equal(report.connections.invalidEvidence, 1);
assert.equal(report.connections.precision, 0.5);
assert.equal(report.connections.routes['model-assisted'], 1);
assert.equal(report.connections.routes['deterministic-local'], 1);
assert.equal(report.connections.surfaces['connections-review'], 2);
assert.equal(report.queries.reviewed, 1);
assert.equal(report.gate.pairReviewComplete, false);
assert.equal(report.gate.queryReviewComplete, true);
assert.equal(report.gate.recommendedDefault, 'off');
assert.doesNotMatch(JSON.stringify(report), /Evidence for/);

assert.throws(
  () => updateEchoEvaluation(evaluations, useful, { label:'excellent' }),
  /Unknown connection review label/,
);

console.log('Lorewell Echo review and calibration contract: PASS');
