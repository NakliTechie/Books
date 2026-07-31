import assert from 'node:assert/strict';
import {
  applyIdeaRelationClassifications,
  buildLibraryIdeaGraph,
  classifyIdeaRelation,
  cosineSimilarity,
  DEFAULT_HYBRID_LEXICAL_WEIGHT,
  DEFAULT_HYBRID_SEMANTIC_WEIGHT,
  DEFAULT_LIBRARY_LINK_MIN_SCORE,
  DEFAULT_LIBRARY_LINKS_PER_IDEA,
  DEFAULT_RELATION_CLASSIFICATION_MIN_CONFIDENCE,
  ideaEmbeddingText,
  ideaEmbeddingsPath,
  ideaEmbeddingVectorPath,
  ideaRecordsPath,
  ideaVectorMap,
  makeIdeaEmbeddingBundle,
  makeSourceGroundedIdeas,
  searchIdeaRecords,
} from '../idea-graph.js';

assert.equal(DEFAULT_LIBRARY_LINK_MIN_SCORE, 0.68);
assert.equal(DEFAULT_LIBRARY_LINKS_PER_IDEA, 8);
assert.equal(DEFAULT_RELATION_CLASSIFICATION_MIN_CONFIDENCE, 0.65);
assert.equal(DEFAULT_HYBRID_SEMANTIC_WEIGHT, 0.72);
assert.ok(Math.abs(DEFAULT_HYBRID_LEXICAL_WEIGHT - 0.28) < 1e-12);

const passages = [{
  passageId:'passage-a',
  text:'Systems improve when feedback arrives quickly and changes behaviour.',
  anchor:{ quoteHash:'sha256:a' },
}];
const record = makeSourceGroundedIdeas({
  workId:'work-a',
  semanticRecord:{
    concepts:[{
      conceptId:'feedback',
      label:'Feedback loops',
      kind:'mechanism',
      description:'Fast feedback changes future behaviour.',
      confidence:0.9,
      evidence:[{ passageId:'passage-a', quoteHash:'sha256:a' }],
      generatedBy:{ extractor:'fixture', mode:'local-model' },
    }],
  },
  passages,
  now:() => '2026-07-30T00:00:00.000Z',
});
assert.equal(record.ideas.length, 1);
assert.equal(record.ideas[0].evidence[0].passageId, 'passage-a');
assert.match(ideaEmbeddingText(record.ideas[0]), /Fast feedback/);
const embeddingBundle = makeIdeaEmbeddingBundle({
  workId:'work-a',
  ideaRecords:record,
  vectors:[[1, 0]],
  model:'fixture',
  dimensions:2,
  inputFingerprint:'sha256:fixture',
  now:() => '2026-07-30T00:00:30.000Z',
});
const embeddingRecord = embeddingBundle.record;
assert.equal(embeddingRecord.rows[0].ideaId, record.ideas[0].ideaId);
assert.equal(embeddingRecord.inputFingerprint, 'sha256:fixture');
assert.equal(embeddingRecord.rows[0].index, 0);
assert.equal(embeddingRecord.rows[0].vector, undefined);
assert.deepEqual(
  ideaVectorMap(embeddingRecord, embeddingBundle.binary).get(record.ideas[0].ideaId),
  [1, 0],
);
assert.equal(ideaRecordsPath('work-a'), 'semantic/work-a/ideas.json');
assert.equal(ideaEmbeddingsPath('work-a'), 'indexes/idea-embeddings/work-a.json');
assert.equal(ideaEmbeddingVectorPath('work-a'), 'indexes/idea-embeddings/work-a.f32');

assert.ok(cosineSimilarity([1, 0], [1, 0]) > 0.999);
assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
assert.equal(classifyIdeaRelation(
  { label:'Feedback loops', statement:'Fast feedback changes behaviour' },
  { label:'feedback loops', statement:'A different explanation' },
  0.9,
).relation, 'same_as');

const ideas = [
  record.ideas[0],
  {
    ...record.ideas[0],
    ideaId:'idea-work-b-feedback',
    workId:'work-b',
    label:'Feedback loops',
  },
  {
    ...record.ideas[0],
    ideaId:'idea-work-c-distance',
    workId:'work-c',
    label:'Unrelated distance',
  },
];
const vectors = new Map([
  [ideas[0].ideaId, [1, 0]],
  [ideas[1].ideaId, [0.99, 0.01]],
  [ideas[2].ideaId, [0, 1]],
]);
const graph = buildLibraryIdeaGraph({
  ideas,
  vectors,
  model:'fixture',
  dimensions:2,
  minScore:0.8,
  now:() => '2026-07-30T00:01:00.000Z',
});
assert.equal(graph.links.length, 1);
assert.equal(
  /^idea-link_[a-f0-9]{16}$/.test(graph.links[0].linkId),
  true,
);
assert.equal(graph.links[0].relation, 'same_as');
assert.deepEqual(graph.links[0].evidence.leftPassageIds, ['passage-a']);
const classified = applyIdeaRelationClassifications(graph, [{
  linkId:graph.links[0].linkId,
  relation:'supports',
  confidence:0.88,
  rationale:'Both describe reinforcing feedback.',
}], {
  provider:'fixture',
  model:'fixture-model',
  now:() => '2026-07-30T00:02:00.000Z',
});
assert.equal(classified.changed, true);
assert.equal(classified.graph.links[0].relation, 'supports');
assert.equal(
  classified.graph.links[0].generatedBy.relationMethod,
  'source-grounded-model-classifier',
);
const lowConfidence = applyIdeaRelationClassifications(graph, [{
  linkId:graph.links[0].linkId,
  relation:'contradicts',
  confidence:0.64,
  rationale:'Below the calibrated acceptance threshold.',
}]);
assert.equal(lowConfidence.changed, false);
assert.equal(lowConfidence.graph.links[0].relation, 'same_as');

const collisionGraph = (firstId) => buildLibraryIdeaGraph({
  ideas:[
    { ...ideas[0], ideaId:firstId, workId:'collision-a' },
    { ...ideas[1], ideaId:'idea-y', workId:'collision-b' },
  ],
  vectors:new Map([[firstId, [1, 0]], ['idea-y', [1, 0]]]),
  model:'fixture',
  dimensions:2,
  minScore:0.8,
});
assert.notEqual(
  collisionGraph('idea/x').links[0].linkId,
  collisionGraph('idea_x').links[0].linkId,
  'pair IDs that normalize to the same punctuation token remain distinct',
);

const results = searchIdeaRecords({
  ideas,
  vectors,
  queryVector:[1, 0],
  query:'feedback',
});
assert.equal(results[0].idea.label, 'Feedback loops');
assert.ok(results[0].score > 0.9);

console.log('Books idea graph contract: PASS');
