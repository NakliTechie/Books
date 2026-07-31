import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BrowserLocalAi,
  browserLocalAiSupported,
  browserLocalProviderDescriptor,
  classifyLocalAiError,
  DEFAULT_LOCAL_AI_MODEL_KEY,
  FIREFOX_LOCAL_AI_MODEL_KEY,
  isFirefoxBrowser,
  LOCAL_AI_MODEL,
  LOCAL_AI_MODELS,
  localAiModel,
  makeLocalAiWorkerSource,
  makeWllamaWorkerSource,
  modelCacheRequestMatches,
  preflightBrowserLocalAi,
  recommendedLocalAiModelKey,
  TRANSFORMERS_JS_MODULE,
  TRANSFORMERS_JS_VERSION,
  WLLAMA_MODULE,
  WLLAMA_VERSION,
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
assert.equal(LOCAL_AI_MODELS.length, 3);
assert.equal(
  localAiModel('gemma-4-e4b').model,
  'onnx-community/gemma-4-E4B-it-ONNX',
);
assert.equal(localAiModel(FIREFOX_LOCAL_AI_MODEL_KEY).runtime, 'wllama-cpu');
assert.equal(localAiModel(FIREFOX_LOCAL_AI_MODEL_KEY).destination, 'browser-wasm');
assert.ok(
  localAiModel(FIREFOX_LOCAL_AI_MODEL_KEY).approximateDownloadBytes
    < 200_000_000,
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

const firefoxScope = {
  navigator:{
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:142.0) ' +
      'Gecko/20100101 Firefox/142.0',
    gpu:{ requestAdapter:async () => ({ features:new Set(['shader-f16']) }) },
  },
  Worker:function Worker() {},
  URL:{ createObjectURL() {}, revokeObjectURL() {} },
  Blob,
  WebAssembly,
};
assert.equal(isFirefoxBrowser(firefoxScope), true);
assert.equal(recommendedLocalAiModelKey(firefoxScope), FIREFOX_LOCAL_AI_MODEL_KEY);
assert.equal(browserLocalAiSupported(firefoxScope, LOCAL_AI_MODEL), false);
assert.equal(
  browserLocalAiSupported(
    firefoxScope,
    localAiModel(FIREFOX_LOCAL_AI_MODEL_KEY),
  ),
  true,
);
assert.equal(
  (await preflightBrowserLocalAi(
    firefoxScope,
    localAiModel(FIREFOX_LOCAL_AI_MODEL_KEY),
  )).code,
  'firefox-wasm',
);
assert.equal(
  (await preflightBrowserLocalAi(firefoxScope, LOCAL_AI_MODEL)).code,
  'firefox-webgpu',
);

const chromiumScope = {
  navigator:{
    userAgent:'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36',
    gpu:{
      requestAdapter:async () => ({
        features:new Set(['shader-f16']),
        limits:{
          maxBufferSize:4_294_967_296,
          maxStorageBufferBindingSize:2_147_483_648,
        },
      }),
    },
  },
  Worker:function Worker() {},
  URL:{ createObjectURL() {}, revokeObjectURL() {} },
  Blob,
  WebAssembly,
};
const chromiumPreflight = await preflightBrowserLocalAi(chromiumScope);
assert.equal(chromiumPreflight.supported, true);
assert.equal(chromiumPreflight.code, 'webgpu-ready');
assert.ok(chromiumPreflight.features.includes('shader-f16'));

const missingF16 = await preflightBrowserLocalAi({
  ...chromiumScope,
  navigator:{
    ...chromiumScope.navigator,
    gpu:{
      requestAdapter:async () => ({
        features:new Set(),
        limits:{},
      }),
    },
  },
});
assert.equal(missingF16.code, 'shader-f16-unavailable');

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

assert.equal(WLLAMA_VERSION, '3.4.1');
assert.match(WLLAMA_MODULE, /@wllama\/wllama@3\.4\.1/);
const wasmWorker = makeWllamaWorkerSource();
assert.match(wasmWorker, /import \{ Wllama \}/);
assert.match(wasmWorker, /LFM2\.5-230M-Q5_K_M\.gguf/);
assert.match(wasmWorker, /n_threads:1/);
assert.match(wasmWorker, /n_gpu_layers:0/);
assert.match(wasmWorker, /createChatCompletion/);
assert.match(wasmWorker, /type:'token', id, token/);

const memoryDiagnostic = classifyLocalAiError(new Error(
  'Deserialize tensor model_embed_tokens failed. Unknown error in memory copy.',
));
assert.equal(memoryDiagnostic.code, 'model-memory');
assert.ok(memoryDiagnostic.actions.includes('clear-cache'));
assert.match(memoryDiagnostic.message, /CPU\/WebAssembly/);

assert.equal(modelCacheRequestMatches({
  url:
    'https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/' +
    'resolve/main/onnx/embed_tokens_q4f16.onnx_data',
}), true);
assert.equal(modelCacheRequestMatches({
  url:'https://huggingface.co/Xenova/all-MiniLM-L6-v2/model.onnx',
}), false);

const scope = {
  navigator:{
    gpu:{
      requestAdapter:async () => ({
        features:new Set(['shader-f16']),
        limits:{},
      }),
    },
  },
  Worker:function Worker() {},
  URL:{
    createObjectURL() { return 'blob:test'; },
    revokeObjectURL() {},
  },
  Blob,
  WebAssembly,
};
const localAi = new BrowserLocalAi(scope);
assert.equal(localAi.snapshot().model.key, 'gemma-4-e2b');
localAi.selectModel('gemma-4-e4b');
assert.equal(localAi.descriptor().model, 'onnx-community/gemma-4-E4B-it-ONNX');
assert.equal(localAi.snapshot().error, null);

const firefoxLocalAi = new BrowserLocalAi(firefoxScope, {
  modelKey:'gemma-4-e2b',
});
assert.equal(
  firefoxLocalAi.snapshot().model.key,
  FIREFOX_LOCAL_AI_MODEL_KEY,
  'Firefox starts on the proven CPU/WebAssembly alternate',
);

const deletedUrls = [];
const cachedRequests = [
  {
    url:
      'https://huggingface.co/onnx-community/gemma-4-E4B-it-ONNX/' +
      'resolve/main/onnx/embed_tokens_q4f16.onnx_data',
  },
  {
    url:'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/model.onnx',
  },
];
scope.caches = {
  async keys() { return ['transformers-cache', 'books-unrelated-cache']; },
  async open(name) {
    const requests = name === 'transformers-cache'
      ? [cachedRequests[0]]
      : [cachedRequests[1]];
    return {
      async keys() { return requests; },
      async delete(request) {
        deletedUrls.push(request.url);
        return true;
      },
    };
  },
};
const cleared = await localAi.clearCachedModel();
assert.equal(cleared.deleted, 1);
assert.deepEqual(deletedUrls, [cachedRequests[0].url]);

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /from '\.\/local-ai-sidecar\.js'/);
assert.match(index, /id="reader-ai-sidecar"/);
assert.match(index, /aria-controls="reader-ai-sidecar"/);
assert.match(index, /id="reader-ai-local-load"/);
assert.match(index, /id="reader-ai-local-model"/);
assert.match(index, /id="provider-ai-local-model"/);
assert.match(index, /value="lfm2-230m-wasm"/);
assert.match(index, /data-ai-local-clear/);
assert.match(index, /data-ai-local-use-wasm/);
assert.match(index, /data-ai-local-diagnostics/);
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
