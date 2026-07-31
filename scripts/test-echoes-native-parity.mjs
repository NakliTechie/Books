import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  buildEchoGraph,
  buildReaderConnectionsForWork,
} from '../echoes.js';

const manifests = [
  { workId:'work-loss', title:'The Shape of Decisions' },
  { workId:'work-story', title:'Mara Keeps the Shop' },
];
const units = [{
  unitId:'unit-work-loss-loss-aversion',
  workId:'work-loss',
  kind:'mechanism',
  lens:'expository',
  label:'Loss aversion',
  statement:'Losses are weighted more heavily than equal gains.',
  confidence:0.92,
  evidence:[{
    passageId:'passage-loss',
    paragraphId:'paragraph-loss',
    quoteHash:'sha256:loss',
    textHash:'sha256:text-loss',
    excerpt:'People commonly weigh a loss more heavily than an equal gain.',
    positionFraction:0.1,
  }],
  userState:{ hidden:false },
}, {
  unitId:'unit-work-story-shop-choice',
  workId:'work-story',
  kind:'character-choice',
  lens:'narrative',
  label:'Mara refuses to surrender the shop',
  statement:'Mara accepts further costs rather than experience surrender as a loss.',
  confidence:0.87,
  evidence:[{
    passageId:'passage-story',
    paragraphId:'paragraph-story',
    quoteHash:'sha256:story',
    textHash:'sha256:text-story',
    excerpt:'Mara keeps the failing shop because surrender feels worse than another costly year.',
    positionFraction:0.4,
  }],
  userState:{ hidden:false },
}];
const vectors = new Map([
  ['unit-work-loss-loss-aversion', [1, 0]],
  ['unit-work-story-shop-choice', [0.99, 0.01]],
]);
const graph = buildEchoGraph({
  units,
  vectors,
  model:'fixture',
  dimensions:2,
});
const normalized = {
  graph:{
    candidateStrategy:graph.candidateStrategy,
    compatibilityStrategy:graph.compatibilityStrategy,
    unitCount:graph.unitCount,
    links:graph.links.map((link) => ({
      linkId:link.linkId,
      leftUnitId:link.leftUnitId,
      rightUnitId:link.rightUnitId,
      relation:link.relation,
      score:link.score,
      evidence:link.evidence,
    })),
  },
  readers:Object.fromEntries(manifests.map((manifest) => {
    const record = buildReaderConnectionsForWork({
      workId:manifest.workId,
      graph,
      units,
      manifests,
    });
    return [manifest.workId, record.connections.map((connection) => ({
      connectionId:connection.connectionId,
      source:connection.source,
      target:connection.target,
      relation:connection.relation,
      direction:connection.direction,
      spoiler:connection.spoiler,
      evidence:connection.evidence,
    }))];
  })),
};
const native = JSON.parse(execFileSync(
  'python3',
  [new URL('./echoes-native-fixture.py', import.meta.url).pathname],
  { encoding:'utf8' },
));
assert.deepEqual(native, normalized, 'browser and native Echo graph/reader IDs agree');

console.log('Lorewell browser/native Echo parity: PASS');
