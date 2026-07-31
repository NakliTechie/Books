import assert from 'node:assert/strict';
import {
  applyEchoCurationToReaderConnections,
  applyEchoRelationClassifications,
  buildEchoGraph,
  buildReaderConnectionsForWork,
  DEFAULT_ECHO_RELATION_MIN_CONFIDENCE,
  ECHO_CURATION_PATH,
  ECHO_GRAPH_VERSION,
  ECHO_RELATION_TYPES,
  echoKindsCompatible,
  inverseEchoRelation,
  makeEchoCurationRecord,
  makeSemanticUnitEmbeddingBundle,
  makeSemanticUnits,
  readerConnectionsPath,
  semanticUnitEmbeddingText,
  semanticUnitEmbeddingsPath,
  semanticUnitEmbeddingVectorPath,
  semanticUnitsPath,
  semanticUnitVectorMap,
  updateEchoConnectionCuration,
  updateEchoWorkExclusion,
} from '../echoes.js';

const passage = (workId, assetId, suffix, text, order = 0) => ({
  passageId:`passage_${suffix}`,
  workId,
  assetId,
  order,
  text,
  structure:{ sectionIndex:0, label:'Fixture' },
  anchor:{ quoteHash:`sha256:${suffix}` },
  paragraphs:[{
    paragraphId:`paragraph_${suffix}`,
    passageId:`passage_${suffix}`,
    workId,
    assetId,
    order,
    passageOrder:order,
    text,
    structure:{ sectionIndex:0, paragraphIndex:0, fragmentIndex:0, fragmentCount:1 },
    anchor:{ quoteHash:`sha256:${suffix}`, textHash:`sha256:text-${suffix}` },
  }],
});

const lossPassage = passage(
  'work-loss',
  'asset-loss',
  'loss',
  'People commonly weigh a loss more heavily than an equal gain.',
);
const storyPassage = passage(
  'work-story',
  'asset-story',
  'story',
  'Mara keeps the failing shop because surrender feels worse than another costly year.',
  8,
);

const lossUnits = makeSemanticUnits({
  workId:'work-loss',
  semanticRecord:{
    sourceFingerprint:'sha256:loss',
    concepts:[{
      conceptId:'loss-aversion',
      label:'Loss aversion',
      kind:'mechanism',
      description:'Losses are weighted more heavily than equal gains.',
      confidence:0.92,
      evidence:[{ passageId:lossPassage.passageId, paragraphId:'paragraph_loss', quoteHash:'sha256:loss' }],
      generatedBy:{ extractor:'fixture', mode:'model-assisted' },
    }],
    scenes:[],
  },
  passages:[lossPassage],
  now:() => '2026-07-31T00:00:00.000Z',
});
const storyUnits = makeSemanticUnits({
  workId:'work-story',
  semanticRecord:{
    sourceFingerprint:'sha256:story',
    concepts:[],
    scenes:[{
      sceneId:'shop-choice',
      label:'Mara refuses to surrender the shop',
      kind:'character-choice',
      description:'Mara accepts further costs rather than experience surrender as a loss.',
      confidence:0.87,
      evidence:[{ passageId:storyPassage.passageId, paragraphId:'paragraph_story', quoteHash:'sha256:story' }],
      generatedBy:{ extractor:'fixture', mode:'model-assisted' },
    }],
  },
  passages:[storyPassage],
  now:() => '2026-07-31T00:00:00.000Z',
});

assert.equal(lossUnits.recordType, 'books.semantic-units');
const lossMechanism = lossUnits.units.find((unit) => unit.sourceRecordId === 'loss-aversion');
const storyChoice = storyUnits.units.find((unit) => unit.sourceRecordId === 'shop-choice');
assert.equal(lossMechanism.kind, 'mechanism');
assert.equal(lossMechanism.lens, 'expository');
assert.equal(storyChoice.kind, 'character-choice');
assert.equal(storyChoice.lens, 'narrative');
assert.equal(storyChoice.evidence[0].paragraphId, 'paragraph_story');
assert.match(semanticUnitEmbeddingText(lossMechanism), /Loss aversion/);

const allUnits = [...lossUnits.units, ...storyUnits.units];
const bundle = makeSemanticUnitEmbeddingBundle({
  workId:'work-loss',
  unitRecord:lossUnits,
  vectors:[[1, 0]],
  model:'fixture',
  dimensions:2,
  inputFingerprint:'sha256:input',
});
assert.deepEqual(
  semanticUnitVectorMap(bundle.record, bundle.binary).get(lossMechanism.unitId),
  [1, 0],
);

const vectors = new Map([
  [lossMechanism.unitId, [1, 0]],
  [storyChoice.unitId, [0.99, 0.01]],
]);
let graph = buildEchoGraph({
  units:allUnits,
  vectors,
  model:'fixture',
  dimensions:2,
  minScore:0.8,
  now:() => '2026-07-31T00:01:00.000Z',
});
assert.equal(graph.graphVersion, ECHO_GRAPH_VERSION);
assert.equal(graph.links.length, 1);
assert.equal(graph.links[0].relation, 'echoes');
assert.deepEqual(graph.links[0].evidence.leftPassageIds, ['passage_loss']);
assert.ok(ECHO_RELATION_TYPES.includes('dramatizes'));
assert.ok(ECHO_RELATION_TYPES.includes('dramatized_by'));
assert.equal(inverseEchoRelation('dramatized_by'), 'dramatizes');
assert.equal(echoKindsCompatible(lossMechanism, storyChoice), true);
assert.equal(
  echoKindsCompatible(
    { kind:'definition', lens:'expository' },
    { kind:'plot-outcome', lens:'narrative' },
  ),
  false,
  'typed compatibility rejects a merely similar but unsupported cross-lens pair',
);
assert.equal(DEFAULT_ECHO_RELATION_MIN_CONFIDENCE, 0.72);

const ignored = applyEchoRelationClassifications(graph, [{
  linkId:graph.links[0].linkId,
  relation:'dramatized_by',
  confidence:0.71,
  explanation:'Below the inline classification threshold.',
}]);
assert.equal(ignored.changed, false);
const protectedGraph = {
  ...graph,
  links:[{
    ...graph.links[0],
    relation:'same_as',
    generatedBy:{ method:'exact-normalized-idea' },
  }],
};
const protectedResult = applyEchoRelationClassifications(protectedGraph, [{
  linkId:graph.links[0].linkId,
  relation:'echoes',
  confidence:0.84,
  explanation:'A weaker model guess.',
}]);
assert.equal(protectedResult.changed, false);
assert.equal(protectedResult.graph.links[0].relation, 'same_as');
const applied = applyEchoRelationClassifications(graph, [{
  linkId:graph.links[0].linkId,
  relation:'dramatized_by',
  confidence:0.93,
  explanation:'Loss aversion is dramatized by the fictional choice without treating fiction as proof.',
}], {
  provider:'fixture',
  model:'fixture-model',
  now:() => '2026-07-31T00:02:00.000Z',
});
assert.equal(applied.changed, true);
graph = applied.graph;
assert.equal(graph.links[0].relation, 'dramatized_by');

const storyConnections = buildReaderConnectionsForWork({
  workId:'work-story',
  graph,
  units:allUnits,
  manifests:[
    { workId:'work-loss', title:'The Shape of Decisions' },
    { workId:'work-story', title:'Mara Keeps the Shop' },
  ],
  minScore:0.8,
  now:() => '2026-07-31T00:03:00.000Z',
});
assert.equal(storyConnections.recordType, 'books.reader-connections');
assert.equal(storyConnections.connections.length, 1);
assert.equal(storyConnections.connections[0].source.paragraphId, 'paragraph_story');
assert.equal(storyConnections.connections[0].target.workTitle, 'The Shape of Decisions');
assert.match(storyConnections.connections[0].explanation, /dramatizes loss aversion/i);
assert.equal(storyConnections.connections[0].relation, 'dramatizes');
assert.equal(
  storyConnections.connections[0].spoiler.risk,
  'low',
  'a nonfiction mechanism does not inherit narrative spoiler treatment',
);
assert.equal(semanticUnitsPath('work-a'), 'semantic/work-a/units.json');
assert.equal(
  semanticUnitEmbeddingsPath('work-a'),
  'indexes/echo-unit-embeddings/work-a.json',
);
assert.equal(
  semanticUnitEmbeddingVectorPath('work-a'),
  'indexes/echo-unit-embeddings/work-a.f32',
);
assert.equal(
  readerConnectionsPath('work-a'),
  'semantic/work-a/reader-connections.json',
);
assert.equal(ECHO_CURATION_PATH, 'annotations/echoes.json');

const fixedNow = () => '2026-07-31T00:04:00.000Z';
let curation = makeEchoCurationRecord({}, fixedNow);
curation = updateEchoConnectionCuration(
  curation,
  storyConnections.connections[0].connectionId,
  {
    hidden:true,
    rating:'wrong',
    linkId:storyConnections.connections[0].linkId,
  },
  fixedNow,
);
const hiddenConnections = buildReaderConnectionsForWork({
  workId:'work-story',
  graph,
  units:allUnits,
  manifests:[
    { workId:'work-loss', title:'The Shape of Decisions' },
    { workId:'work-story', title:'Mara Keeps the Shop' },
  ],
  curation,
  minScore:0.8,
  now:fixedNow,
});
assert.equal(
  hiddenConnections.connectionCount,
  0,
  'hidden connection feedback survives a reader-index rebuild',
);
assert.equal(
  applyEchoCurationToReaderConnections(storyConnections, curation).connectionCount,
  0,
  'canonical feedback also filters a stale materialized reader index',
);
const oppositeConnections = buildReaderConnectionsForWork({
  workId:'work-loss',
  graph,
  units:allUnits,
  manifests:[
    { workId:'work-loss', title:'The Shape of Decisions' },
    { workId:'work-story', title:'Mara Keeps the Shop' },
  ],
  curation,
  minScore:0.8,
  now:fixedNow,
});
assert.equal(oppositeConnections.connectionCount, 0,
  'Wrong feedback hides the canonical link in both directions');
curation = updateEchoWorkExclusion(curation, 'work-loss', true, fixedNow);
const excludedWork = buildReaderConnectionsForWork({
  workId:'work-story',
  graph,
  units:allUnits,
  manifests:[
    { workId:'work-loss', title:'The Shape of Decisions' },
    { workId:'work-story', title:'Mara Keeps the Shop' },
  ],
  curation,
  minScore:0.8,
  now:fixedNow,
});
assert.equal(excludedWork.connectionCount, 0, 'work exclusions remain canonical');

console.log('Lorewell Echoes domain contract: PASS');
