import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BrowserLocalAi,
  browserLocalAiSupported,
  browserLocalProviderDescriptor,
  DEFAULT_LOCAL_AI_MODEL_KEY,
  LOCAL_AI_MODEL,
  LOCAL_AI_MODELS,
  localAiModel,
  makeLocalAiWorkerSource,
  TRANSFORMERS_JS_MODULE,
  TRANSFORMERS_JS_VERSION,
} from '../local-ai-sidecar.js';

assert.equal(TRANSFORMERS_JS_VERSION, '4.2.0');
assert.equal(
  TRANSFORMERS_JS_MODULE,
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm',
);
assert.equal(DEFAULT_LOCAL_AI_MODEL_KEY, 'gemma-4-e2b');
assert.deepEqual(browserLocalProviderDescriptor(), {
  providerClass:'browser-local',
  destination:'browser-webgpu',
  endpoint:null,
  model:'onnx-community/gemma-4-E2B-it-ONNX',
});
assert.equal(LOCAL_AI_MODEL.dtype, 'q4f16');
assert.equal(LOCAL_AI_MODEL.recommended, true);
assert.ok(LOCAL_AI_MODEL.approximateDownloadBytes >= 3_000_000_000);
assert.equal(LOCAL_AI_MODELS.length, 2);
assert.equal(
  localAiModel('gemma-4-e4b').model,
  'onnx-community/gemma-4-E4B-it-ONNX',
);
assert.equal(
  localAiModel('not-a-model').key,
  DEFAULT_LOCAL_AI_MODEL_KEY,
  'unknown persisted selections fall back to the smaller model',
);

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
assert.match(worker, /onnx-community\/gemma-4-E2B-it-ONNX/);
assert.match(worker, /dtype:"q4f16"/);
assert.match(worker, /device:'webgpu'/);
assert.match(worker, /Array\.isArray\(message\?\.content\)/);
assert.match(worker, /\['system', 'developer'\]\.includes/);
assert.match(worker, /enable_thinking:false/);
assert.match(worker, /do_sample:false/);
assert.match(worker, /env\.useBrowserCache = true/);
assert.match(worker, /type:'booted'/);
assert.match(worker, /self\.addEventListener\('message'/);
assert.match(
  makeLocalAiWorkerSource(localAiModel('gemma-4-e4b')),
  /onnx-community\/gemma-4-E4B-it-ONNX/,
);

const scope = {
  navigator:{ gpu:{} },
  Worker:function Worker() {},
  URL:{
    createObjectURL() { return 'blob:test'; },
    revokeObjectURL() {},
  },
  Blob,
};
const localAi = new BrowserLocalAi(scope);
assert.equal(localAi.snapshot().model.key, 'gemma-4-e2b');
localAi.selectModel('gemma-4-e4b');
assert.equal(localAi.descriptor().model, 'onnx-community/gemma-4-E4B-it-ONNX');
assert.equal(localAi.snapshot().error, null);

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /from '\.\/local-ai-sidecar\.js'/);
assert.match(index, /id="reader-ai-sidecar"/);
assert.match(index, /aria-controls="reader-ai-sidecar"/);
assert.match(index, /id="reader-ai-local-load"/);
assert.match(index, /id="reader-ai-local-model"/);
assert.match(index, /id="provider-ai-local-model"/);
assert.match(index, /data-ai-provider-preset="ollama"/);
assert.match(index, /data-ai-provider-preset="lm-studio"/);
assert.match(index, /data-ai-provider-preset="byok"/);
assert.match(index, /id="ai-provider-test"/);
assert.doesNotMatch(index, /id="reader-ai-dialog"/);
assert.match(
  index,
  /if \(browserLocalAi\.ready\)[\s\S]*?kind:'browser-local'/,
  'the on-device route is available to reader, Ask, and enrichment capabilities',
);

console.log('Books local AI sidecar contract: PASS');
