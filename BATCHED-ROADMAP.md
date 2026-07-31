# Books — Batched roadmap

> **Lifecycle:** `active` — the dependency-aware execution plan for work that
> remains after Books 2.0.
>
> **Updated:** 2026-07-31

Books already has the semantic-library foundation: standalone and NakliOS
operation, durable Folder libraries, background ingestion, local embeddings,
source-grounded ideas, cross-book relationships, hybrid search, a native
reader, and local/BYOK AI. This plan is for proving that foundation on real
libraries and extending it without turning every pending idea into one
unbounded release.

The deferral history and revisit triggers remain in [DEFERRED.md](DEFERRED.md).
This document owns execution order.

## Rules for the batches

- A batch must leave a usable, releasable product.
- Later batches do not start until their named dependency gate passes.
- Decision spikes end in an explicit Adopt, Adapt, or Reject record; they do
  not silently become production integrations.
- Reading, lexical search, and user-authored metadata must continue to work
  when AI, OCR, embeddings, or a remote provider is unavailable.
- Source files are immutable. Generated data is inspectable, removable,
  rebuildable, and tied to source evidence and model provenance.
- Browser, Folder, Crate, and NakliOS boundaries stay explicit. No batch may
  copy or move a library between backends without a user action.

## Sequence at a glance

| Batch | Outcome | Depends on | State |
|---|---|---|---|
| 0 | Release hygiene and real-library proof | Books 2.0 | Local Folder proof passed; sync-folder/soak checks pending |
| 1 | OCR Adopt / Adapt / Reject decision | Batch 0 corpus and evidence | Defaults accepted; runtime corpus gate pending |
| 2 | Semantic quality and ingestion operations | Batch 0 evidence | Production intelligence enabled; labeled real queries pending |
| 2A | Echoes: source-grounded reader connections | Batch 2 labeled quality gate | Planned |
| 3 | Folder durability at collection scale | Batch 0 evidence | Local restore-after-gap gate passed; sync-folder gate pending |
| 4 | Source-grounded illustration vertical slice | Batch 2 quality gate; Batch 1 where OCR is required | Product hold |
| 5 | Private continuity and mobile handoff | Batch 3 storage/conflict gate | Product hold |
| 6 | Reader depth and accessibility | Batch 0; may run beside Batches 1–3 | Demand-ranked |
| 7 | New formats and Calibre-shaped bets | Dedicated approval and corpus | Parked |

After Batch 0, Batches 1 and 2 may run in parallel. Batch 2A turns the proven
semantic foundation into paragraph-level, cross-genre reader connections and
starts only after the labeled Batch 2 quality gate. Batch 3 may also begin
once the Folder evidence in Batch 0 is complete. Batch 6 is independent but
must be ranked against observed demand. Batches 4, 5, and 7 remain closed
until their explicit product gates are opened.

---

## Batch 0 — Release hygiene and real-library proof

**Outcome:** The shipped foundation is quiet, observable, and proven against a
real collection rather than only fixtures.

### Work

- [x] Stop the browser regression harness from writing
  `books-library*.json` fixture exports into Downloads. The harness now
  intercepts and validates the portable bundle in memory.
- [x] Run the live Chrome regression and confirm the Downloads count is
  unchanged before and after. The candidate host regression passed in Chrome
  without creating a `books-library*.json` file.
- [x] Capture a processing report for the current 40-book production library:
  40 available sources and 40 core-complete jobs; 20,910 passages, 636
  concepts, 457 scenes, 636 source-grounded ideas, zero issues, and 1,677
  cross-book relationships after the user-enabled MiniLM encoder completed.
- [x] Ship a portable Folder-library report command and an in-app processing
  summary with per-book failures and safe retry.
- [x] Exercise synthetic Folder mode at 1,000 and 10,000 books:
  initial recursion, warm diff, modify, move/rename, and remove.
- [x] Exercise Folder mode with a user-granted disposable real directory:
  recursive initial scan, add, repeated missing scans, and restored rename.
  The restored-after-gap case exposed a duplicate-work bug; browser and native
  reconciliation now retain the prior missing inventory long enough to
  recover the original work identity, and the regression passes.
- [x] Detect case/normalization path collisions, quarantine a source that
  changes during fingerprinting, and recover a partial `current.json` from the
  latest completed generation.
- [ ] Test permission loss and partial external-sync writes in a live browser.
- [ ] Run a long processing soak while opening and reading books; background
  work must yield rather than make the reader brittle.
- [x] Turn every failure found in the autonomous run into a regression
  fixture: malformed inventory recovery, path collisions, source churn,
  browser/native scene/link parity, low-confidence classification, and
  export-download interception are now covered.
- [x] Smoke the production standalone Browser library by opening a real EPUB in
  Faithful and Native modes, and run the candidate NakliOS host regression in
  Chrome. Both completed without a browser console error.

### Exit gate

- Normal test runs create no user-visible downloads.
- Every book in the real-library report is readable or has a specific,
  visible source/format error.
- Processing state is explainable per book; no work is silently stuck.
- Folder reconciliation preserves identity and user-authored records through
  the tested mutations.
- The full automated suite and standalone/NakliOS smoke tests pass.

---

## Batch 1 — OCR decision spike

**Outcome:** Decide whether and how scanned books enter the semantic library.
PaddleOCR is the first candidate, not a preselected dependency.

### Work

- [x] Generate a self-authored CC0 synthetic corpus covering clean, skewed,
  low-contrast, mixed-script, vertical, table, formula, and multi-column
  diagnostics.
- [x] Add pinned, checksum-verified public-domain/CC0 real pages covering
  born-scanned, photographed negative-control, handwritten, complex-table,
  figure/footer, multi-column, and formula cases. A positive readable camera
  page remains part of the runtime ground-truth gate.
- [x] Compare three visible routes:
  - in-browser PaddleOCR.js;
  - a local PaddleOCR service;
  - an optional, explicitly consented hosted endpoint.
- [ ] Measure text accuracy, reading order, headings, tables, formulas, footnotes,
  figures, page coordinates, confidence, latency, memory, battery use, model
  size, cancellation, and resume behavior.
  Package and official model-download byte budgets are recorded; runtime
  measurements remain blocked on the live browser harness.
- [x] Verify the official SDK/package and PaddleOCR licensing; verify each
  selected model weight again when the corpus locks.
  Treat “unlimited” only as local/self-hosted inference under the user's own
  compute budget.
- [x] Specify versioned OCR artifacts with page/region anchors, confidence,
  provenance, review state, and faithful-source navigation.
- [x] Record an Adopt, Adapt, or Reject decision for each route in
  `OCR-DECISION.md`.

### Exit gate

- One architecture decision records quality, privacy, licensing, and resource
  evidence.
- The chosen route has clear `unavailable`, `queued`, `partial`, `failed`, and
  `needs review` states.
- Deleting OCR artifacts cannot alter the PDF, annotations, or portable
  records.

---

## Batch 2 — Semantic quality and ingestion operations

**Outcome:** Make the shipped intelligence trustworthy and operable across a
real library.

### Work

- [x] Create a small labeled synthetic query set and benchmark
  lexical, semantic, and hybrid retrieval.
- [ ] Repeat the labeled benchmark against the real collection.
- [x] Lock the initial passage, concept/evidence, idea-link, hybrid-search, and
  model-classification defaults in `SEMANTIC-QUALITY-GATE.md`; repeat
  calibration against labeled real-library judgments before changing them.
- [x] Measure MiniLM recall, vector storage, cold model-start cost, and
  diagnostic degradation on
  multilingual and long-form material.
- [x] Expand the processing surface with per-book stage, progress, retry,
  cancellation, failure reason, provider/model, and resource-budget details.
- [x] Keep interactive reading and user-requested AI ahead of background work;
  verify pause, resume, low-battery, and Data Saver behavior.
- [x] Test the native indexer and browser executor against the same collection and
  compare portable artifacts, not just counts.
- [x] Complete the metadata/cover provider spike and recommend opt-in
  Open Library lookup.
- [x] Implement approved Open Library lookup as an explicit per-book action.
  Bound results, omit credentials/referrer data, preserve user/source-authored
  fields, retain accepted provenance, and download a capped cover only after a
  separate user action.

### Exit gate

- Retrieval and relationship quality meet written thresholds on labeled
  queries.
- Every failed or delayed job is visible and recoverable.
- Browser and native executors agree on schemas, identity, and evidence
  anchors.
- User curation survives regeneration of all derived semantic data.

---

## Batch 2A — Echoes: source-grounded reader connections

**Outcome:** Turn the library-level graph into discreet, optional connections
at the point of reading, including nonfiction↔nonfiction,
fiction↔fiction, and fiction↔nonfiction relationships.

The approved product direction is in [ECHOES-VISION.md](ECHOES-VISION.md).
Paragraph anchors, typed semantic units, graph v2, materialized reader
connections, Native-reader indicators, optional audio, executor parity, and
rollout gates are sequenced in [ECHOES-WORKPLAN.md](ECHOES-WORKPLAN.md).

### Gate

- Begin schema and fixture work immediately after the relation contract is
  locked.
- Do not enable inline indicators by default until the real-library Batch 2
  labels establish a stricter reader-quality threshold.
- Every Echo must retain evidence in both works, respect spoiler controls, and
  disappear safely when its derived artifact is missing.
- Reading, lexical search, and authored text remain independent of Echoes and
  generative AI.

---

## Batch 3 — Folder durability at collection scale

**Outcome:** Folder libraries remain durable under large collections and
ordinary external file activity.

### Work

- [x] Benchmark cold scan, warm diff, one-file change, rename, move, and deletion
  review at 1,000 and 10,000 small sources.
- [ ] Repeat the scale matrix with representative EPUB/PDF sizes and a
  network/external-sync folder.
- [x] Harden case-collision, normalization, excluded-directory, symlink,
  changing-source, and interrupted-inventory behavior.
- [ ] Exercise concurrent external-sync behavior against a real sync folder.
- [x] Decide that periodic incremental reconciliation is sufficient for the
  current evidence. Build a
  packaged native watcher only if measured workflows require it.
- [x] Design multiple physical roots only after defining how identity, duplicate
  paths, disconnects, and per-root `.books/` sidecars appear to the user.
- [x] Define explicit copy/move semantics between Browser, Folder, and Crate,
  including rollback and conflict review.
- [x] Add interrupted-inventory recovery and catalog/identity repair drills.

### Exit gate

- Stress tests demonstrate bounded work and recoverable interruption.
- Missing or partially written sources never become silent destructive
  deletes.
- Any watcher has a visible lifecycle and provides measured value beyond
  rerunning the incremental indexer.
- Multiple roots or backend movement remain disabled until their conflict and
  rollback semantics are approved.

---

## Batch 4 — Source-grounded illustrations

**Outcome:** Prove one optional illustration flow that adds understanding
without compromising source fidelity.

**Gate:** Product hold. Open only after Batch 2 proves semantic evidence
quality. Scanned-source flows also require the relevant Batch 1 OCR decision.

### Work

- Decide illustration purpose, cadence, style consistency, provider,
  on-device versus remote execution, consent, safety, copyright posture,
  storage budget, and regeneration controls.
- Build one end-to-end narrative slice for selected key scenes.
- Build one expository slice for a concept diagram only if the visual can be
  grounded in cited passages.
- Link every artifact to evidence passages and generation provenance.
- Keep images optional, removable, cacheable, and separate from the original.
- Reuse the artifact pipeline for generated title cards only after the first
  slice passes.

### Exit gate

- The user explicitly opts in to generation and can see its destination.
- Removing every generated artifact leaves Faithful and Native reading intact.
- The evaluation demonstrates that illustrations clarify more often than they
  misrepresent.

---

## Batch 5 — Private continuity and mobile handoff

**Outcome:** Reading state and portable records can move between devices
without surrendering the private-library model.

**Gate:** Product hold until Batch 3 proves storage and conflict semantics.

### Work

- Select a transport; the existing version, ancestry, tombstone, and conflict
  contract remains transport-independent.
- Define encryption, device identity, pairing, revocation, recovery, offline
  operation, quotas, and selective-library behavior.
- Implement a two-device vertical slice for reading position, annotations,
  curation, and derived-data invalidation.
- Treat originals and large derived artifacts as separate sync classes.
- Design a mobile reading/handoff surface only after the continuity slice is
  reliable.

### Exit gate

- Two-device offline, concurrent-edit, deletion, restore, and recovery tests
  pass deterministically.
- The transport is visible and user-selected; no library content leaves a
  device implicitly.
- Derived artifacts can be rebuilt rather than becoming sync-critical state.

---

## Batch 6 — Reader depth and accessibility

**Outcome:** Improve everyday reading based on measured demand.

Candidate slices are TTS, dictionaries, reading profiles, deeper
format-specific controls, keyboard/screen-reader improvements, and additional
Native/Faithful navigation. Rank them independently by accessibility impact,
frequency of use, implementation risk, and cross-format coverage. Each slice
gets its own corpus, fallback behavior, and acceptance test; this batch is not
a promise to ship the whole list.

---

## Batch 7 — New formats and separate bets

**Outcome:** Keep breadth from destabilizing the core.

CBZ/CBR and DjVu require dedicated extractor and reader contracts plus a
representative corpus. Conversion, book polishing, news acquisition, store
integration, device management, CLI automation, plugins, and other
Calibre-shaped capabilities are separate product bets. None enters the core
because Calibre has it; each requires a user outcome, threat model, maintenance
budget, and explicit approval.

## Final access and release run

Local Chrome, Cloudflare, Folder, and Background Intelligence access is now
available. The current release run verifies standalone and NakliOS modes,
captures the refreshed production processing report, reruns the suite, pushes
`main`, and inspects the Git-triggered Worker deployment.

Only two evidence gates remain deliberately deferred:

1. the real sync-managed/network Folder soak, because no representative folder
   is currently available;
2. the official PaddleOCR.js runtime corpus/resource benchmark before the
   production OCR queue is opened.
