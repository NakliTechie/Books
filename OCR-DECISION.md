# Books OCR decision

> **Decision:** Adapt a two-tier local-first PaddleOCR architecture.
>
> **Status:** Architecture and artifact contract accepted; runtime corpus
> benchmark remains required before the OCR queue is opened in production.
>
> **Date:** 2026-07-30

## Decision

1. **Adapt the official PaddleOCR.js SDK as the browser route.** It is the
   first candidate for ordinary scanned pages because it runs PP-OCRv5 in the
   browser through ONNX Runtime Web and exposes text regions rather than only a
   transcription. The currently published package is
   `@paddleocr/paddleocr-js` 0.4.2, Apache-2.0, with an unpacked SDK package of
   roughly 23.8 MB. Model bytes are separate and must be measured by language
   and tier.
2. **Adopt a visible local PaddleOCR service as the high-fidelity route.**
   PP-StructureV3 is the candidate for reading order, tables, formulas,
   figures, multi-column layouts, and page-to-Markdown structure that the
   compact browser route cannot promise.
3. **Defer hosted PaddleOCR to an optional remote destination.** It may use the
   same artifact contract, but Books will not send page images until the user
   selects that destination and consents to it.
4. **Reject direct reuse of ScanLocal's current Paddle path.** It is useful
   prior art, but currently combines third-party `paddleocr-browser`,
   `esearch-ocr`, remote OpenCV/ONNX scripts, and an English PP-OCRv3 model.
   Books should use the new official SDK and pin/self-host its runtime and model
   assets after the benchmark.

This is an Adapt decision rather than a blanket integration decision. OCR
must remain a derived slow lane. A scanned PDF is readable in Faithful mode
before OCR; processing may report `waiting-for-ocr`, and failed or partial OCR
never masquerades as a complete semantic index.

## Evidence

- PaddleOCR 3.5 introduced the official PaddleOCR.js browser SDK for PP-OCRv5;
  the package source is inside the PaddlePaddle/PaddleOCR repository:
  [PaddleOCR release history](https://github.com/PaddlePaddle/PaddleOCR).
- The official browser package documents `PaddleOCR.create`, Blob/File input,
  ONNX Runtime Web backends, and item-level results:
  [PaddleOCR.js package](https://www.npmjs.com/package/@paddleocr/paddleocr-js).
- PP-StructureV3 covers layout regions, tables, formulas, multi-column reading
  order, chart understanding, and structured JSON/Markdown output:
  [PP-StructureV3 documentation](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/PP-StructureV3.html).
- Official guidance distinguishes mobile/real-time models from server/batch
  models and calls out separate multilingual choices:
  [PaddleOCR model guidance](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/FAQ.en.md).
- PaddleOCR is Apache-2.0. The official JavaScript package also reports
  Apache-2.0; model cards and redistributed weights still require individual
  verification before vendoring.

## Runtime routes

| Route | Decision | Intended use | Boundary |
|---|---|---|---|
| Official PaddleOCR.js | Adapt | Printed pages, local browser queue | Explicit first model download; pinned/self-hosted assets; Worker; cancellation |
| Local PaddleOCR / PP-StructureV3 service | Adopt | Layout, tables, formulas, large batches | User-visible localhost endpoint; no stored credential; health/model discovery |
| Hosted endpoint | Defer | Devices unable to run local OCR | Destination-specific consent for page images |
| Existing ScanLocal Paddle implementation | Reject direct reuse | Reference implementation only | Third-party/outdated dependency path |

## Artifact contract

`ocr-artifact.js` defines `books.ocr-artifact` schema version 1. Each record is
bound to `workId`, `assetId`, and the exact source fingerprint. Pages retain
source dimensions, rotation, language, confidence, ordered regions, text, and
page/box anchors. Regions distinguish text, headings, lists, tables, formulas,
figures, captions, and footnotes.

Allowed lifecycle states are:

```text
unavailable → queued → running → partial → complete
                         └──────→ failed
                         └──────→ needs-review
```

The engine block records route, provider, model, model version, runtime, and
whether inference was local. The artifact lives at
`semantic/<workId>/ocr/<assetId>.json`. Deleting it is sufficient to remove
OCR output; originals, annotations, work manifests, and reading positions are
outside that path.

## Corpus and benchmark gate

`npm run corpus:ocr -- /path/to/output` generates six self-authored CC0
fixtures for clean, low-contrast, skewed, two-column/table/formula,
mixed-script, and rotated-region behavior.

`npm run corpus:ocr-public -- /path/to/output` downloads and SHA-256 verifies
six pinned real-world fixtures: two formula/table pages and one authored-figure
page from Library of Congress digitized books, a multi-column Chronicling
America newspaper, a handwritten Andrew Jackson Papers page, and a CC0 real
camera photograph of a curved open book. The photographed fixture is
deliberately a low-readable-text negative control: a responsible OCR route
should return `needs-review`, not invent a transcription. Rights, source pages,
byte lengths, expected excerpts, and region classes live in
`test/ocr-public-corpus.json`.

The official 0.4.2 SDK currently maps to these model downloads:

| Model pair | Detection | Recognition | Pair total |
|---|---:|---:|---:|
| PP-OCRv6 tiny | 1,792,000 B | 4,526,080 B | 6,318,080 B |
| PP-OCRv5 mobile | 4,843,520 B | 16,701,440 B | 21,544,960 B |
| PP-OCRv6 small | 9,891,840 B | 21,319,680 B | 31,211,520 B |

These are model archives only. The npm package is 23,798,562 unpacked bytes
and also depends on OpenCV.js and ONNX Runtime Web. Transfer size, runtime
assets, caching, and memory must be measured in the actual Books worker.

The production queue remains closed until the combined corpus measures:

- born-scanned, skewed, warped, low-contrast, photographed, and rotated pages;
- English, Devanagari, Arabic, and mixed-script text;
- vertical text where relevant;
- single/multi-column order, headings, lists, footnotes, figures, captions,
  tables, and formulas;
- character/word error, region detection, reading-order accuracy, table
  structure, formula fidelity, and anchor geometry;
- cold download, warm start, per-page latency, peak memory, battery impact,
  cancellation, resume, and storage;
- model, dictionary, runtime, and weight licenses.

The current public corpus provides manually checked excerpts, not complete
line-by-line ground truth. Full character/word error claims therefore remain
blocked on verified transcription. A positive camera-captured page with
readable text and public-domain ground truth is still desirable in addition to
the negative control.

Pass criteria must be set per route. A compact browser model is not required
to equal PP-StructureV3 on complex layout; it must instead fail honestly and
offer the local-service route.

## User-visible failure rules

- `unavailable`: no compatible browser/local endpoint.
- `queued`: the source is readable; OCR has not started.
- `running`: page and total progress are visible and cancellable.
- `partial`: completed pages are retained; the next page is the checkpoint.
- `failed`: a retryable reason and engine provenance are retained.
- `needs-review`: low confidence, ambiguous order, or unsupported structure is
  linked back to the source page.

Remote page transmission, background model download, and selecting a default
language pack remain user-facing decisions and are deferred together.
