export const TRANSFORMERS_JS_VERSION = '4.2.0';
export const TRANSFORMERS_JS_MODULE =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@' +
  TRANSFORMERS_JS_VERSION + '/+esm';

export const DEFAULT_LOCAL_AI_MODEL_KEY = 'gemma-4-e2b';
export const LOCAL_AI_MODELS = Object.freeze([
  Object.freeze({
    key:'gemma-4-e2b',
    providerClass:'browser-local',
    destination:'browser-webgpu',
    endpoint:null,
    model:'onnx-community/gemma-4-E2B-it-ONNX',
    label:'Gemma 4 E2B',
    shortLabel:'E2B',
    dtype:'q4f16',
    approximateDownloadBytes:3_400_000_000,
    recommended:true,
  }),
  Object.freeze({
    key:'gemma-4-e4b',
    providerClass:'browser-local',
    destination:'browser-webgpu',
    endpoint:null,
    model:'onnx-community/gemma-4-E4B-it-ONNX',
    label:'Gemma 4 E4B',
    shortLabel:'E4B',
    dtype:'q4f16',
    approximateDownloadBytes:5_200_000_000,
    recommended:false,
  }),
]);
const LOCAL_AI_MODEL_BY_KEY = new Map(
  LOCAL_AI_MODELS.map((model) => [model.key, model]),
);

export function localAiModel(modelKey = DEFAULT_LOCAL_AI_MODEL_KEY) {
  return LOCAL_AI_MODEL_BY_KEY.get(String(modelKey))
    || LOCAL_AI_MODEL_BY_KEY.get(DEFAULT_LOCAL_AI_MODEL_KEY);
}

export const LOCAL_AI_MODEL = localAiModel();

function abortError() {
  const error = new Error('Local generation was stopped.');
  error.name = 'AbortError';
  return error;
}

export function browserLocalProviderDescriptor(model = LOCAL_AI_MODEL) {
  return {
    providerClass:model.providerClass,
    destination:model.destination,
    endpoint:model.endpoint,
    model:model.model,
  };
}

export function browserLocalAiSupported(scope = globalThis) {
  return Boolean(
    scope
    && scope.navigator
    && scope.navigator.gpu
    && typeof scope.Worker === 'function'
    && scope.URL?.createObjectURL
    && scope.Blob,
  );
}

export function makeLocalAiWorkerSource(
  modelDefinition = LOCAL_AI_MODEL,
  transformersModule = TRANSFORMERS_JS_MODULE,
) {
  return `
import {
  env,
  AutoProcessor,
  Gemma4ForConditionalGeneration,
  TextStreamer,
  InterruptableStoppingCriteria,
} from ${JSON.stringify(transformersModule)};

env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;

let processor = null;
let model = null;
let activeRequestId = null;
const stoppingCriteria = new InterruptableStoppingCriteria();
const progress = data => self.postMessage({ type:'progress', data });
self.postMessage({ type:'booted' });

async function loadModel() {
  self.postMessage({ type:'status', data:'Loading tokenizer and processor…' });
  processor = await AutoProcessor.from_pretrained(
    ${JSON.stringify(modelDefinition.model)},
    { progress_callback:progress },
  );
  self.postMessage({
    type:'status',
    data:${JSON.stringify('Loading ' + modelDefinition.label + ' into WebGPU…')},
  });
  model = await Gemma4ForConditionalGeneration.from_pretrained(
    ${JSON.stringify(modelDefinition.model)},
    {
      dtype:${JSON.stringify(modelDefinition.dtype)},
      device:'webgpu',
      progress_callback:progress,
    },
  );
  self.postMessage({
    type:'status',
    data:${JSON.stringify('Warming up ' + modelDefinition.label + '…')},
  });
  const warmup = processor.tokenizer('a');
  await model.generate({ ...warmup, max_new_tokens:1 });
  self.postMessage({ type:'ready' });
}

async function generate(messages, id, maxTokens) {
  activeRequestId = id;
  stoppingCriteria.reset();
  const streamer = new TextStreamer(processor.tokenizer, {
    skip_prompt:true,
    skip_special_tokens:true,
    callback_function:token => {
      self.postMessage({ type:'token', id, token });
    },
  });
  const prompt = processor.apply_chat_template(messages, {
    add_generation_prompt:true,
  });
  const inputs = await processor(prompt, null, null, {
    add_special_tokens:false,
  });
  await model.generate({
    ...inputs,
    max_new_tokens:Math.min(2048, Math.max(1, Number(maxTokens) || 600)),
    do_sample:true,
    temperature:0.2,
    top_k:32,
    top_p:0.9,
    streamer,
    stopping_criteria:stoppingCriteria,
  });
  self.postMessage({ type:'complete', id });
  activeRequestId = null;
}

self.addEventListener('message', async ({ data }) => {
  try {
    if (data.type === 'load') {
      await loadModel();
    } else if (data.type === 'generate') {
      if (!model || !processor) {
        throw new Error(
          ${JSON.stringify('Load ' + modelDefinition.label + ' first.')},
        );
      }
      await generate(data.messages || [], data.id, data.maxTokens);
    } else if (data.type === 'stop') {
      if (!data.id || data.id === activeRequestId) stoppingCriteria.interrupt();
    }
  } catch (error) {
    self.postMessage({
      type:'error',
      id:data.id || null,
      data:error?.message || String(error),
    });
    if (data.type === 'generate') activeRequestId = null;
  }
});
`;
}

export class BrowserLocalAi {
  constructor(scope = globalThis, {
    modelKey = DEFAULT_LOCAL_AI_MODEL_KEY,
  } = {}) {
    this.scope = scope;
    this.model = localAiModel(modelKey);
    this.worker = null;
    this.workerUrl = null;
    this.ready = false;
    this.loading = false;
    this.progress = null;
    this.status = browserLocalAiSupported(scope)
      ? 'Ready to load on demand.'
      : 'WebGPU is unavailable in this browser.';
    this.error = null;
    this.listeners = new Set();
    this.pending = new Map();
    this.loadPromise = null;
    this.loadResolve = null;
    this.loadReject = null;
  }

  get supported() {
    return browserLocalAiSupported(this.scope);
  }

  descriptor() {
    return browserLocalProviderDescriptor(this.model);
  }

  snapshot() {
    return {
      supported:this.supported,
      ready:this.ready,
      loading:this.loading,
      progress:this.progress,
      status:this.status,
      error:this.error,
      model:this.model,
    };
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  emit() {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      try { listener(snapshot); } catch (_) {}
    }
  }

  selectModel(modelKey) {
    const next = localAiModel(modelKey);
    if (next.key === this.model.key) return this.snapshot();
    this.dispose();
    this.model = next;
    this.status = 'Ready to load ' + next.label + ' on demand.';
    this.emit();
    return this.snapshot();
  }

  async hasCachedModel(model = this.model) {
    if (!this.scope.caches?.keys) return false;
    try {
      const names = await this.scope.caches.keys();
      for (const name of names) {
        const cache = await this.scope.caches.open(name);
        const keys = await cache.keys();
        if (keys.some((request) => {
          try {
            return decodeURIComponent(request.url).includes(model.model);
          } catch (_) {
            return request.url.includes(model.model);
          }
        })) return true;
      }
    } catch (_) {}
    return false;
  }

  ensureWorker() {
    if (this.worker) return;
    if (!this.supported) {
      throw new Error('WebGPU is unavailable. Use NakliOS AI or an endpoint provider.');
    }
    const source = makeLocalAiWorkerSource(this.model);
    this.workerUrl = this.scope.URL.createObjectURL(
      new this.scope.Blob([source], { type:'application/javascript' }),
    );
    this.worker = new this.scope.Worker(this.workerUrl, { type:'module' });
    this.worker.addEventListener('message', (event) => this.handleMessage(event.data));
    this.worker.addEventListener('error', (event) => {
      event.preventDefault?.();
      const location = event.filename
        ? ' (' + event.filename + ':' + (event.lineno || 0) + ')'
        : '';
      this.failAll(new Error(
        (event.message || 'The browser blocked the local AI runtime.') + location,
      ));
    });
  }

  handleMessage(data) {
    if (data.type === 'booted') {
      this.status = 'Transformers.js is ready. Starting ' + this.model.label + '…';
      this.emit();
      return;
    }
    if (data.type === 'progress') {
      const raw = Number(data.data?.progress);
      this.progress = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : null;
      this.status = this.progress == null
        ? 'Downloading model files…'
        : 'Downloading ' + this.model.label + '… ' +
          Math.round(this.progress) + '%';
      this.emit();
      return;
    }
    if (data.type === 'status') {
      this.status = String(data.data || 'Loading…');
      this.emit();
      return;
    }
    if (data.type === 'ready') {
      this.ready = true;
      this.loading = false;
      this.progress = 100;
      this.status = this.model.label + ' is ready on this device.';
      this.error = null;
      this.loadResolve?.(this.snapshot());
      this.clearLoadPromise();
      this.emit();
      return;
    }
    if (data.type === 'token') {
      const request = this.pending.get(data.id);
      if (!request) return;
      request.text += String(data.token || '');
      request.onDelta(request.text);
      return;
    }
    if (data.type === 'complete') {
      const request = this.pending.get(data.id);
      if (!request) return;
      this.pending.delete(data.id);
      request.cleanup();
      if (!request.text.trim()) {
        request.reject(new Error(
          this.model.label + ' returned no readable answer.',
        ));
      } else {
        request.resolve({
          text:request.text.trim(),
          model:this.model.model,
          usage:null,
        });
      }
      return;
    }
    if (data.type === 'error') {
      const error = new Error(String(data.data || 'Local AI failed.'));
      if (data.id && this.pending.has(data.id)) {
        const request = this.pending.get(data.id);
        this.pending.delete(data.id);
        request.cleanup();
        request.reject(error);
      } else if (this.loading) {
        this.loading = false;
        this.error = error.message;
        this.status = 'Could not load ' + this.model.label + '.';
        this.loadReject?.(error);
        this.clearLoadPromise();
        this.emit();
      }
    }
  }

  clearLoadPromise() {
    this.loadPromise = null;
    this.loadResolve = null;
    this.loadReject = null;
  }

  async load() {
    if (this.ready) return this.snapshot();
    if (this.loadPromise) return this.loadPromise;
    this.ensureWorker();
    this.loading = true;
    this.progress = null;
    this.error = null;
    this.status = 'Starting the local model…';
    this.loadPromise = new Promise((resolve, reject) => {
      this.loadResolve = resolve;
      this.loadReject = reject;
    });
    this.emit();
    this.worker.postMessage({ type:'load' });
    return this.loadPromise;
  }

  generate(messages, {
    signal,
    maxTokens = 1200,
    onStatus = () => {},
    onDelta = () => {},
  } = {}) {
    if (!this.ready || !this.worker) {
      return Promise.reject(new Error(
        'Load ' + this.model.label + ' before asking Books AI.',
      ));
    }
    if (this.pending.size) {
      return Promise.reject(new Error(
        this.model.label + ' is already answering another request.',
      ));
    }
    const id = this.scope.crypto?.randomUUID?.()
      || 'local_' + Date.now().toString(36);
    onStatus('generating');
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.worker?.postMessage({ type:'stop', id });
        const request = this.pending.get(id);
        if (!request) return;
        this.pending.delete(id);
        request.cleanup();
        reject(abortError());
      };
      const cleanup = () => signal?.removeEventListener('abort', abort);
      this.pending.set(id, {
        resolve,
        reject,
        cleanup,
        onDelta,
        text:'',
      });
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener('abort', abort, { once:true });
      this.worker.postMessage({
        type:'generate',
        id,
        messages,
        maxTokens,
      });
    });
  }

  stopWorker(error, { report = true } = {}) {
    this.worker?.terminate();
    if (this.workerUrl) this.scope.URL.revokeObjectURL(this.workerUrl);
    this.worker = null;
    this.workerUrl = null;
    if (this.loading) {
      this.loading = false;
      this.loadReject?.(error);
      this.clearLoadPromise();
    }
    for (const request of this.pending.values()) {
      request.cleanup();
      request.reject(error);
    }
    this.pending.clear();
    this.ready = false;
    this.progress = null;
    if (report) {
      this.error = error.message;
      this.status = 'Could not start the local AI runtime.';
      this.emit();
    } else {
      this.error = null;
      this.status = this.supported
        ? 'Ready to load on demand.'
        : 'WebGPU is unavailable in this browser.';
    }
  }

  failAll(error) {
    this.stopWorker(error, { report:true });
  }

  dispose() {
    this.stopWorker(abortError(), { report:false });
  }
}
