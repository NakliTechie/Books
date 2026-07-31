# Books — semantic-library security review

> **Reviewed:** 2026-07-30 against the semantic-library implementation and
> Cloudflare deployment artifacts in this repository.
>
> **Release verdict:** no known release-blocking application vulnerability.
> The remaining risks below are explicit operational or dependency risks, not
> hidden content-transfer paths.

## Scope and trust boundaries

Books runs in two modes:

- Standalone at `https://books.naklitechie.com`, with an origin-scoped
  IndexedDB virtual filesystem.
- Embedded in NakliOS, where the parent supplies filesystem and optional AI
  capabilities.

Cloudflare serves static application assets only. There is no Books Worker
handler, application database, telemetry collector, or server-side book
processing path. Originals, portable records, annotations, passages, indexes,
and semantic records stay in the active Browser, Folder, or Crate backend
unless the user explicitly exports a bundle or enables an AI destination.

The review covers application rendering, source parsers, portable import and
export, the NakliOS message boundary, local/BYOK AI, generated records, browser
storage, Cloudflare headers, and the release artifact.

## Findings and controls

### Source rendering and XSS

- Library metadata and dynamic status surfaces use escaped HTML or DOM
  `textContent`.
- User-supplied HTML/HTM is rendered in an iframe with an empty `sandbox`
  attribute: no scripts, same-origin access, popups, forms, or top navigation.
- Search results from an HTML source are projected into parent-owned text
  nodes; the sandbox is not weakened to highlight a match.
- The production Content Security Policy disables plugins and base-URL
  rewriting with `object-src 'none'` and `base-uri 'none'`. Inline script and
  style remain allowed because the application is currently a single-file
  shell. This is an acknowledged hardening opportunity, not an unknown
  exception.

### Parser and original-file boundary

- File extensions are validated by the engine adapter before a source is
  opened.
- EPUB-family parsing uses the pinned vendored Foliate build; PDF parsing uses
  the pinned vendored pdf.js build and local worker/font assets.
- Extracted passages and indexes are derived data. Parser failure, incomplete
  extraction, or derived-data deletion does not mutate the source or block the
  faithful reader.
- Asset fingerprints are checked during validation, recovery, export, and
  import. Recoverable originals must still match their stored checksum.
- Image-only PDFs are not represented as successfully indexed text. OCR
  remains a separately gated future capability.

### NakliOS message boundary

When embedded, the receive handler rejects messages whose `source` is not the
current `window.parent`. This pins the capability channel to the actual host
window while preserving cross-origin embedding. Filesystem and host-AI
requests use request IDs, explicit response types, cancellation, and timeouts.

Standalone mode does not acquire host filesystem or AI authority through this
channel. Non-sensitive theme messages from other windows have no access to
library bytes.

### Local and BYOK AI

AI is optional. Reading, lexical search, annotations, concepts produced by
deterministic extraction, and recovery work without a model.

- The built-in route runs a pinned Gemma 4 E2B or E4B ONNX model in a
  dedicated WebGPU Worker. Firefox instead defaults to the pinned LFM2.5 230M
  Q5_K_M GGUF in wllama's single-thread CPU/WebAssembly worker. The user
  explicitly starts the selected model download; Transformers.js model
  caching is enabled, while the wllama fallback makes no durable-cache
  guarantee. Model-file requests go to Hugging Face, and the pinned
  Transformers.js or wllama module loads from jsDelivr. Book text is not
  included in either request.
- Compatibility routing checks the browser, Worker/WebAssembly primitives,
  the WebGPU adapter, and `shader-f16` before model download. Model cache
  recovery enumerates CacheStorage requests and deletes only URLs matching
  the selected model; it never clears a whole cache, IndexedDB, library
  storage, or semantic indexes.
- The CSP permits only that named script and Worker origin for the module
  import graph and permits `blob:` fetches required by both Foliate's
  generated EPUB sections and the local module Worker. `wasm-unsafe-eval` is
  narrowly enabled in `script-src` so the pinned ONNX runtime can compile
  WebAssembly, and `blob:` is enabled there for ONNX's generated WebGPU
  backend module; arbitrary JavaScript `eval` remains disallowed. The existing
  `worker-src` and `frame-src` restrictions remain in place.
- Standalone configuration always shows the endpoint, model, and whether the
  destination is local or remote.
- A remote provider must use HTTPS and requires consent tied to the exact
  destination origin and named capabilities.
- A local provider may use HTTP for loopback/LAN operation; its visible
  endpoint is the consent boundary. Books tests `/v1/models` before use and
  explains that Ollama requires `OLLAMA_ORIGINS` while LM Studio requires its
  CORS server setting.
- Credentials are rejected in provider URLs. API keys are held in
  `sessionStorage`, cleared when the destination changes, and excluded from
  portable records and run provenance.
- NakliOS AI is host-mediated and uses the host's configured destination and
  consent.
- Only retrieved or selected passages are sent for a request. Prompts label
  those passages as untrusted quoted data and instruct the model not to follow
  source-embedded instructions.
- Model semantic records are length-bounded, type-normalized, capped, and
  accepted only when their evidence IDs resolve to supplied passages.
- Ask answers are shown as verified only when their citations resolve to the
  retrieved source set. Provider output without valid citations is visibly
  unverified.
- Run provenance stores a public provider descriptor, prompt/configuration
  hashes, consent class, model identity, and validation result—never the API
  key.

These controls reduce prompt-injection and accidental disclosure risk; they do
not make a remote model deterministic or trustworthy. The user remains
responsible for the configured destination.

### Portable export, import, and recovery

- Portable bundles are schema-versioned and validated before mutation.
- Source filenames reject paths, traversal, unsafe identities, and duplicates.
- Imported originals are decoded and checksum-verified before the commit
  stage. Conflicts are reported instead of silently overwriting different
  bytes.
- Import is designed to be idempotent and resumable. Rebuildable catalog,
  passage, index, semantic, processing, and cover data is deliberately omitted
  from the portable core.
- Trash is reversible and source restoration verifies the original checksum.
- Clearing derived data preserves originals, manifests, annotations, Trash,
  provider settings, and portable views.

### Cloudflare release surface

- The Worker project is assets-only and declares `dist/` as its deployment
  artifact.
- The build copies the application shell, all semantic modules, security
  headers, and pinned reader dependencies. CI verifies the module graph and
  runs a Wrangler dry deployment.
- Metrics and dependency instrumentation are disabled. Sampled Worker
  observability can contain ordinary static-request metadata such as URL,
  status, timing, and user agent; no book content, search query, annotation, or
  AI prompt is sent through the Worker.
- `X-Content-Type-Options`, Referrer Policy, a restrictive Permissions Policy,
  CSP, immutable vendor caching, and `workers.dev` no-indexing are configured.
- `frame-ancestors` and `X-Frame-Options` are intentionally absent because
  Books must remain embeddable by NakliOS. The in-app capability boundary is
  enforced by message-source pinning.

## Secrets review

No API keys, Cloudflare tokens, GitHub tokens, `.env` files, or application
credentials are required in the repository. Wrangler authentication and
Cloudflare/GitHub linkage are environment- or control-plane-owned.

## Residual risks and maintenance

1. **Vendored parsers:** Foliate and pdf.js process complex, untrusted formats.
   Keep their versions pinned, monitor upstream security notices, and retest
   before upgrades.
2. **Large or adversarial files:** browser memory and CPU are finite. Parsing
   is resumable and failure-safe, but stricter per-format resource budgets and
   decompression-bomb limits should accompany any new archive format.
3. **Browser storage:** IndexedDB confidentiality inherits the browser profile
   and operating-system account. Books does not add at-rest encryption.
4. **Configured AI destinations:** a local or remote provider can retain what
   the user sends. The UI makes that destination visible and requires explicit
   remote consent, but cannot enforce the provider's retention policy.
5. **Prompt injection/model behavior:** untrusted-data framing, evidence
   validation, and visible verification are defenses, not a proof of model
   compliance.
6. **Inline CSP:** moving the inline application script and styles into hashed
   or nonce-controlled assets would permit removing `'unsafe-inline'`.
7. **Embeddability:** any site may frame the public standalone shell. It does
   not gain the user's NakliOS capabilities, but a future authentication
   surface should add an explicit framing policy or host handshake.
8. **On-device model supply chain:** the built-in route downloads executable
   model runtime code from the explicitly allowlisted, pinned jsDelivr package
   and model weights from the named Hugging Face repository. Pin updates,
   upstream compromise, and cached artifact invalidation require release
   review.

## Verification evidence

Release verification includes:

- Unit/contract coverage for storage, migration, processing, search,
  semantics, AI consent, grounding, portability, recovery, and deployment.
- A hosted end-to-end harness covering semantic reading, smart views,
  enrichment, grouping, cited Ask, concept curation, portability, recovery,
  and rebuild.
- A 60-work scale harness covering deterministic facets and title discovery.
- A clean production build plus `wrangler deploy --dry-run`.
- Live custom-domain checks for the HTML shell and every imported module after
  the Git-driven deployment completes.
