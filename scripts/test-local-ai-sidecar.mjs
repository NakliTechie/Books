import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  browserLocalAiSupported,
  browserLocalProviderDescriptor,
  LOCAL_AI_MODEL,
  makeLocalAiWorkerSource,
  TRANSFORMERS_JS_MODULE,
  TRANSFORMERS_JS_VERSION,
} from '../local-ai-sidecar.js';

assert.equal(TRANSFORMERS_JS_VERSION, '4.2.0');
assert.equal(
  TRANSFORMERS_JS_MODULE,
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm',
);
assert.deepEqual(browserLocalProviderDescriptor(), {
  providerClass:'browser-local',
  destination:'browser-webgpu',
  endpoint:null,
  model:'onnx-community/gemma-4-E4B-it-ONNX',
});
assert.equal(LOCAL_AI_MODEL.dtype, 'q4f16');
assert.ok(LOCAL_AI_MODEL.approximateDownloadBytes >= 4_000_000_000);

assert.equal(browserLocalAiSupported({ navigator:{} }), false);
assert.equal(browserLocalAiSupported({
  navigator:{ gpu:{} },
  Worker:function Worker() {},
  URL:{ createObjectURL() {} },
  Blob,
}), true);

const worker = makeLocalAiWorkerSource();
assert.match(worker, /Gemma4ForConditionalGeneration/);
assert.match(worker, /InterruptableStoppingCriteria/);
assert.match(worker, /onnx-community\/gemma-4-E4B-it-ONNX/);
assert.match(worker, /dtype:"q4f16"/);
assert.match(worker, /device:'webgpu'/);
assert.match(worker, /env\.useBrowserCache = true/);
assert.match(worker, /self\.addEventListener\('message'/);

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /from '\.\/local-ai-sidecar\.js'/);
assert.match(index, /id="reader-ai-sidecar"/);
assert.match(index, /aria-controls="reader-ai-sidecar"/);
assert.match(index, /id="reader-ai-local-load"/);
assert.doesNotMatch(index, /id="reader-ai-dialog"/);
assert.match(
  index,
  /if \(browserLocalAi\.ready\)[\s\S]*?kind:'browser-local'/,
  'the on-device route is available to reader, Ask, and enrichment capabilities',
);

console.log('Books local AI sidecar contract: PASS');
