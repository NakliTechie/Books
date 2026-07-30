# Books benchmark record

> **Last run:** 2026-07-30
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
| 1,000 | 2.22 s | 0.50 s | 0.51 s | 0.51 s | 0.47 s |
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

Model load was 10.93 seconds from a fresh temporary cache and corpus/query
encoding was 1.38 seconds. Vectors are 384-dimensional Float32 values, or
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
memory, battery, cancellation, and resume remain unmeasured because the
authenticated Chrome control session is unavailable. The manually checked
expected excerpts are diagnostic anchors, not complete full-page ground truth,
so no character-error-rate claim is made.
