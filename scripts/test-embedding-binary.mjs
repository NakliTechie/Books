import assert from 'node:assert/strict';
import {
  decodeIdeaVectors,
  encodeIdeaVectors,
  IDEA_VECTOR_HEADER_BYTES,
  IDEA_VECTOR_MAGIC,
} from '../embedding-binary.js';

const encoded = encodeIdeaVectors([
  [1, 0, 0.5],
  [0, 1, -0.25],
], 3);
assert.equal(
  encoded.byteLength,
  IDEA_VECTOR_HEADER_BYTES + 2 * 3 * Float32Array.BYTES_PER_ELEMENT,
);
assert.equal(String.fromCharCode(...encoded.slice(0, 4)), IDEA_VECTOR_MAGIC);
const decoded = decodeIdeaVectors(encoded, {
  expectedRows:2,
  expectedDimensions:3,
});
assert.equal(decoded.rows, 2);
assert.equal(decoded.dimensions, 3);
assert.ok(Math.abs(decoded.vectors[1][2] + 0.25) < 1e-6);
assert.throws(() => decodeIdeaVectors(encoded, { expectedDimensions:4 }));

console.log('Books binary embedding contract: PASS');
