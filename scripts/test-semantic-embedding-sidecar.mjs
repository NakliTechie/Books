import assert from 'node:assert/strict';
import {
  BrowserSemanticEncoder,
  DEFAULT_SEMANTIC_EMBEDDING_MODEL,
  makeSemanticEmbeddingWorkerSource,
  semanticEmbeddingSupported,
} from '../semantic-embedding-sidecar.js';

assert.equal(DEFAULT_SEMANTIC_EMBEDDING_MODEL.dimensions, 384);
assert.ok(DEFAULT_SEMANTIC_EMBEDDING_MODEL.approximateDownloadBytes < 50_000_000);
assert.equal(semanticEmbeddingSupported({}), false);
assert.equal(semanticEmbeddingSupported({
  Worker:function Worker() {},
  URL:{ createObjectURL() {} },
  Blob,
}), true);

const workerSource = makeSemanticEmbeddingWorkerSource();
assert.match(workerSource, /feature-extraction/);
assert.match(workerSource, /Xenova\/all-MiniLM-L6-v2/);
assert.match(workerSource, /device:'wasm'/);
assert.match(workerSource, /normalize:true/);
assert.match(workerSource, /env\.useBrowserCache = true/);

const scope = {
  Worker:function Worker() {},
  URL:{
    createObjectURL() { return 'blob:semantic'; },
    revokeObjectURL() {},
  },
  Blob,
};
const encoder = new BrowserSemanticEncoder(scope);
assert.equal(encoder.snapshot().model.dimensions, 384);
assert.equal(encoder.snapshot().supported, true);

console.log('Books semantic embedding sidecar contract: PASS');
