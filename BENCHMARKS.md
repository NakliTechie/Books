# Books benchmark record

> **Last run:** 2026-07-31
>
> These are reproducible development gates, not universal performance claims.
> Run them on release hardware and representative real collections before
> publishing numbers.

## Folder durability

Command:

```sh
npm run benchmark:indexer -- <book-count>
```

The benchmark creates nested Markdown sources, performs a cold native index,
a warm no-change diff, one in-place source change, one cross-directory move,
and one missing-file reconciliation. It verifies that the move keeps its
original work identity and the missing source remains a reviewable catalog
record.

| Books | Cold | Warm | One change | Move | Missing |
|---:|---:|---:|---:|---:|---:|
| 1,000 | 2.40 s | 0.48 s | 0.48 s | 0.52 s | 0.55 s |
| 10,000 | 35.77 s | 7.80 s | 5.65 s | 7.29 s | 4.99 s |

Result: the current incremental command is sufficient for an explicit
large-library refresh. A continuously running native watcher remains deferred:
it would add lifecycle and packaging cost without yet proving that it improves
the browser Folder workflow. Revisit when real collections show that explicit
or focus-triggered diffs miss changes or are too disruptive.

Limitations: the generated sources are small Markdown files. The benchmark
isolates inventory, fingerprint, manifest, passage, lexical, and deterministic
semantic overhead; it does not represent large PDF/EPUB parsing, OCR, model
downloads, or network filesystems.

The 2026-07-31 check also ran the portable report against the durable local
Folder fixture: 3/3 sources were available and core-complete, with 74 passages,
48 concepts, 18 scenes, 48 grounded ideas, and zero reported issues. The
10,000-source timing remains the 2026-07-30 run.

## Semantic retrieval

Command:

```sh
npm run benchmark:semantic
```

The benchmark downloads
`sentence-transformers/all-MiniLM-L6-v2`, embeds a labeled 12-topic fixture,
and compares lexical, semantic, and the shipped 72/28 semantic/lexical hybrid
weight. The gate requires semantic and hybrid recall@3 of at least 90%, and
hybrid MRR of at least 0.85.

| Mode | Top 1 | Recall@3 | MRR |
|---|---:|---:|---:|
| Lexical | 92% | 92% | 0.933 |
| MiniLM semantic | 100% | 100% | 1.000 |
| Hybrid 72/28 | 100% | 100% | 1.000 |

Model load was 10.85 seconds and corpus/query encoding was 0.35 seconds on the
2026-07-31 rerun. Vectors are 384-dimensional Float32 values, or
1,536 raw bytes per idea before manifest and filesystem overhead.

The multilingual diagnostics intentionally do not gate the English model:

- a Hindi photosynthesis query ranked the expected English idea third;
- a French compound-interest query ranked the expected English idea seventh.

Result: keep the current English MiniLM and hybrid weighting for the first
quality gate. Do not claim multilingual semantic parity. A multilingual model
comparison needs a real multilingual corpus plus an explicit download,
latency, and storage budget.

Limitations: this fixture tests retrieval mechanics and paraphrases, not the
quality of concept extraction from the user's library. The production
roughly-40-book report and labeled real-library queries remain required.

## Local generative providers

Representative endpoint checks used the same OpenAI-compatible discovery and
chat paths that Books exposes in its provider settings:

- Ollama discovered `qwen2.5:0.5b` and `qwen2.5:3b`. The 0.5B response omitted
  the required source marker and was correctly unsuitable for a grounded Books
  answer; the 3B response returned a concise answer with `[S1]`.
- LM Studio discovered and loaded `google/gemma-4-12b-qat` as
  `books-gemma4-smoke`. The runtime estimated 7.49 GiB and reported 6.66 GiB
  after a 25.98-second load. A 256-token request returned a grounded `[S1]`
  answer. An 80-token request spent its budget on reasoning and returned no
  visible answer, so reasoning models need an adequate output-token budget.
- The cached Gemma 4 E2B browser route reached Ready in about ten seconds,
  produced a coherent page-grounded answer, and stopped a longer request on
  demand. This was a warm-cache smoke, not a cold-download measurement.

Result: the shipped provider boundary works against real Ollama and LM Studio
endpoints and the browser worker remains responsive to cancellation. Model
quality still matters: Books must retain source-marker validation and surface
an empty/reasoning-only response as a provider failure rather than a success.

Limitations: this run did not capture a cold Gemma 4 E2B transfer, peak browser
memory, or forced worker-crash recovery. Those stay device/browser-specific
release diagnostics rather than launch performance claims.

## OCR corpus readiness

Commands:

```sh
npm run corpus:ocr -- /path/to/synthetic-output
npm run corpus:ocr-public -- /path/to/public-output
```

The synthetic generator produced six CC0 fixtures. The public downloader
retrieved and SHA-256 verified six pinned real-world fixtures totaling
3,091,637 bytes: historical formulas, a dense table, authored figures and
captions, a multi-column newspaper, handwriting, and a real camera
negative-control. The negative control is expected to become `needs-review`
rather than produce invented text.

Official model-archive budgets recorded from the PaddleOCR.js 0.4.2 asset map
are 6,318,080 bytes for the PP-OCRv6 tiny pair, 21,544,960 bytes for the
PP-OCRv5 mobile pair, and 31,211,520 bytes for the PP-OCRv6 small pair. These
exclude the 23,798,562-byte unpacked SDK package, its runtime dependencies, and
browser cache overhead.

Result: corpus acquisition and integrity pass. Runtime OCR quality, latency,
memory, battery, cancellation, and resume remain unmeasured because Books does
not yet ship the candidate recognition runtime. The production OCR queue stays
closed. The manually checked expected excerpts are diagnostic anchors, not
complete full-page ground truth, so no character-error-rate claim is made.
