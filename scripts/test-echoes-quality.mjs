import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_ECHO_CANDIDATE_MIN_SCORE,
  DEFAULT_ECHO_RELATION_MIN_CONFIDENCE,
  DEFAULT_INLINE_ECHO_MIN_SCORE,
  ECHO_RELATION_TYPES,
  echoKindsCompatible,
} from '../echoes.js';

const corpus = JSON.parse(readFileSync(
  new URL('../fixtures/echoes-quality-v1.json', import.meta.url),
  'utf8',
));
assert.equal(corpus.recordType, 'books.echo-quality-corpus');
assert.equal(corpus.privacy, 'synthetic');
assert.equal(corpus.thresholds.candidateMinimum, DEFAULT_ECHO_CANDIDATE_MIN_SCORE);
assert.equal(corpus.thresholds.inlineMinimum, DEFAULT_INLINE_ECHO_MIN_SCORE);
assert.equal(
  corpus.thresholds.classificationMinimum,
  DEFAULT_ECHO_RELATION_MIN_CONFIDENCE,
);

const directions = new Set(corpus.pairs.map((pair) => pair.direction));
for (const required of [
  'fiction-to-fiction',
  'nonfiction-to-nonfiction',
  'nonfiction-to-fiction',
  'negative',
  'adversarial',
  'spoiler',
]) assert.ok(directions.has(required), `quality corpus covers ${required}`);

for (const pair of corpus.pairs) {
  for (const relation of pair.expected.relations) {
    assert.ok(ECHO_RELATION_TYPES.includes(relation), `${pair.pairId} uses known relation`);
  }
  if (pair.expected.display) {
    assert.equal(
      echoKindsCompatible(
        { kind:pair.left.kind },
        { kind:pair.right.kind },
      ),
      true,
      `${pair.pairId} uses compatible typed units`,
    );
  }
}
assert.ok(corpus.pairs.some((pair) => pair.expected.spoilerRisk === 'high'));
assert.ok(corpus.pairs.some((pair) => pair.left.evidence.includes('SYSTEM:')));
assert.ok(corpus.pairs.some((pair) => pair.left.textHash === pair.right.textHash));

console.log('Lorewell Echoes quality corpus contract: PASS');
