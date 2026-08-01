# Lorewell Echoes — work plan

> **Lifecycle:** `release candidate` — engineering phases are implemented;
> real-library human labeling and the default-rollout decision remain gated.
>
> **Vision:** [ECHOES-VISION.md](ECHOES-VISION.md)  
> **Date:** 2026-07-31

## Outcome

Deliver discreet, optional, source-grounded connections at paragraph level in
Lorewell's Native reader. The same system must connect nonfiction concepts,
fictional scenes and plot elements, and cross-genre concept-to-story examples.

This plan extends the shipped ingestion, passage, idea-embedding, library
graph, and Native-reader foundation. It does not replace those systems.

## Current foundation

Already shipped:

- recursive Folder ingestion and incremental reconciliation;
- resumable browser and native processing executors;
- passage extraction and local lexical search;
- deterministic and model-assisted concepts/scenes;
- a compact local MiniLM encoder and binary vector shards;
- bounded cross-work idea candidates and typed relations;
- hybrid search and exact passage navigation;
- Native reflow with passage-level concept evidence;
- user-hideable, rebuildable semantic artifacts with provenance.

The current production evidence contains 40 processed works, 20,910 passages,
636 concepts, 457 scenes, 636 source-grounded ideas, and 1,677 cross-work
relationships. Echoes now materializes typed paragraph-level reader records and
exposes them in Native mode, work details, and library search when the required
local semantic artifacts are available.

## Release sequence

| Phase | Outcome | Dependency | State |
|---|---|---|---|
| 0 | Quality corpus and relation contract | Existing 40-book library | Synthetic contract complete; human labels pending |
| 1 | Stable paragraph anchors and schemas | Phase 0 relation contract | Complete |
| 2 | Typed fiction/nonfiction unit extraction | Phase 1 | Complete |
| 3 | Cross-work candidate and relation graph v2 | Phases 1–2 | Complete |
| 4 | Materialized reader-connection index | Phase 3 | Complete |
| 5 | Native reader indicators and Echo cards | Phase 4 | Complete |
| 6 | Optional spoken Echoes | Phase 5 | Browser speech baseline complete |
| 7 | Browser/native parity, scale, and recovery | Phases 1–5 | Complete |
| 8 | Real-library quality gate and rollout | Phases 5 and 7 | Awaiting human evaluation |

Phases must leave reading and lexical search usable when embeddings, a
generative model, or a provider are unavailable. No phase may change source
files or make derived intelligence canonical.

## Implementation evidence

- `passages-v3` emits stable paragraph IDs, UTF-16 offsets, structure,
  quote/text hashes, and faithful-engine fallbacks in both executors.
- `books.semantic-units`, `library-echo-links-v2`, and
  `books.reader-connections` are rebuildable artifacts; canonical hide,
  quality, spoiler, and work-exclusion feedback lives in
  `annotations/echoes.json`.
- Fiction, nonfiction, and mixed works use typed units and a compatibility
  matrix before bounded cross-work matching. Optional pair classification can
  refine a relation but cannot weaken deterministic strong relations below the
  release threshold.
- Native mode provides Off, Indicators, and Indicators + asides controls. The
  compact card retains evidence from both books, conceals spoiler-sensitive
  targets, speaks only on request, jumps to an exact related paragraph, and
  keeps a route back.
- Generated indicator and aside prose is CSS/ARIA presentation metadata, not a
  text node inside the authored paragraph, so it cannot contaminate copy,
  highlights, source offsets, or indexing.
- `fixtures/echoes-quality-v1.json` covers cross-genre positives,
  within-genre positives, vocabulary-only negatives, duplicates,
  instruction-like book text, and a high-spoiler target.
- The regular test suite checks domain behavior, the quality corpus,
  browser/native unit and graph identity, security, reports, scale, and deploy
  output. The live Chrome host harness additionally exercises indicator → card
  → reveal → exact related passage → return while retaining the full NakliOS
  reader regression.

The remaining gate needs a reader's judgments on a representative real
collection; automation cannot truthfully decide whether a connection is
surprising, useful, repetitive, or merely plausible.

---

## Phase 0 — Quality corpus and relation contract

**Outcome:** Define what a useful Echo is before optimizing extraction or UI.

### Work

- Select a privacy-safe evaluation slice from the existing collection:
  fiction↔fiction, nonfiction↔nonfiction, and fiction↔nonfiction.
- Label positive, borderline, and wrong pairs using both source passages.
- Include mixed works, recurring motifs, similar vocabulary with different
  meanings, contradictions, and likely spoilers.
- Lock the directed relation ontology and its wording rules.
- Define separate display thresholds for search results, work-details links,
  reader indicators, and automatic asides. Inline thresholds must be strictest.
- Define “same plot/pattern” as a strong claim that requires model-supported
  event structure, not embedding similarity alone.
- Record user-feedback labels separately from generated artifacts.

### Deliverables

- Versioned labeled-pair fixture and evaluator format.
- Relation definitions with allowed source/target unit kinds.
- Initial precision, evidence, diversity, density, and spoiler gates.
- Prompt-injection and adversarial-book-text cases.

### Exit gate

- Every displayable relation has an example, counterexample, and safe wording.
- Fiction is never treated as factual evidence.
- The evaluation set can distinguish a useful insight from a merely similar
  topic.

---

## Phase 1 — Paragraph anchors and portable schemas

**Outcome:** Give every rendered paragraph and semantic unit a stable,
rebuildable evidence location.

### Work

- Extend passage segmentation with paragraph records containing normalized
  offsets, structure, order, exact/quote hashes, and source-engine fallbacks.
- Derive stable `paragraphId` values from work/asset identity, structural
  location, and normalized content without relying on rendered DOM order alone.
- Preserve paragraph-to-passage and paragraph-to-faithful-source mappings.
- Add deterministic re-anchoring after extractor-version changes; unresolved
  anchors remain visible for repair and never attach to merely similar text.
- Define `books.semantic-units` and `books.reader-connections` schemas.
- Keep existing `books.idea-records` readable during migration and invalidate
  only derived v1 graph/vector artifacts when required.

### Proposed semantic-unit shape

```json
{
  "unitId": "unit_<work>_<stable-source>",
  "workId": "work_…",
  "kind": "mechanism",
  "statement": "People weigh a loss more heavily than an equal gain.",
  "participants": [],
  "qualifiers": [],
  "evidence": [{
    "passageId": "passage_…",
    "paragraphId": "paragraph_…",
    "quoteHash": "sha256:…",
    "start": 0,
    "end": 143
  }],
  "confidence": 0.86,
  "generatedBy": {
    "extractor": "semantic-units-v1",
    "mode": "model-assisted",
    "model": "…"
  }
}
```

### Exit gate

- Browser and native executors produce identical IDs and normalized evidence.
- Paragraph anchors survive a no-semantic-change rebuild and representative
  EPUB/PDF/Text extraction changes.
- Removing all new derived records leaves books, annotations, and reading state
  untouched.

---

## Phase 2 — Typed semantic-unit extraction

**Outcome:** Extract comparable units that preserve the difference between an
argument, mechanism, scene, motif, choice, and plot outcome.

### Work

- Classify bounded sections as expository, narrative, mixed, reference, or
  uncertain; do not assume one genre for an entire book.
- Add deterministic baseline units for headings, repeated concepts, explicit
  definitions, claims with local linguistic cues, named participants, and
  section-grounded events.
- Add a constrained structured-extraction prompt for:
  - concepts, claims, mechanisms, principles, examples, arguments,
    counterarguments, consequences, and questions;
  - scenes, events, character choices, beliefs, relationship dynamics,
    conflicts, reversals, consequences, motifs, and plot threads.
- Require every model-emitted unit to cite known paragraph IDs. Reject unknown
  IDs, unsupported labels, oversized statements, and evidence-free records.
- Treat book text as untrusted quoted data and ignore instructions contained
  inside it.
- Preserve deterministic and model-assisted records separately and merge only
  through the existing curation overlay.
- Version prompt, schema, model, source fingerprint, and retry checkpoint.
- Add resource budgets and yield points so interactive reading and reader AI
  retain priority.

### Model routes

- **Core:** deterministic units; no generated Echo explanation.
- **Local baseline:** Gemma 4 E2B or another approved small on-device model.
- **Local endpoint:** Ollama/LM Studio-compatible structured extraction.
- **Remote BYOK:** only with provider-specific consent plus Background
  Intelligence opt-in.

### Exit gate

- All retained units have valid source evidence.
- The extractor distinguishes claim/example and concept/scene on the labeled
  fixture at the written gate.
- Model failure leaves deterministic records, reading, and search operational.

---

## Phase 3 — Candidate retrieval and relation graph v2

**Outcome:** Find a small number of plausible cross-work relationships and
classify their meaning without comparing every paragraph to every other one.

### Work

- Embed bounded semantic-unit statements plus minimal evidence context using
  the compact local encoder.
- Retrieve approximate nearest neighbors across different works.
- Apply kind-compatibility, language, duplicate, same-edition, hidden-unit,
  evidence-quality, and minimum-spread filters before model classification.
- Add directed relations: `counterexample_to`, `illustrates`, `dramatizes`,
  `embodies`, `violates`, `tests`, `parallels`, `contrasts_with`, and `echoes`.
- Pair-classify only bounded candidates using evidence from both works.
- Require the classifier to select from the ontology, state uncertainty, and
  return a short rationale. It may not invent a unit or passage ID.
- Use the weak `echoes` relation only when useful but more specific claims are
  unsupported; otherwise suppress the pair.
- Preserve link score, relation confidence, evidence on both sides,
  directionality, model/provider provenance, and curation state.
- Bound candidates and visible links per unit to prevent graph and UI noise.

### Exit gate

- Every relation opens valid evidence in both books.
- Low-confidence classification cannot overwrite a deterministic strong
  relation or become an inline indicator.
- Graph construction remains bounded at the existing 3,000-idea and
  10,000-book scale contracts.
- The labeled cross-genre slice meets the initial relation-precision gate.

---

## Phase 4 — Materialized reader-connection index

**Outcome:** Make Echoes cheap and deterministic at reading time.

### Work

- Build `semantic/<workId>/reader-connections.json` from graph v2.
- Index connections by source `paragraphId`; store ranked connection IDs,
  target work/unit/paragraph, relation, confidence, and explanation.
- Generate explanations only from the two bounded evidence packages and store
  their provenance. A connection can exist without generated prose.
- Keep no more than a small ranked set per paragraph; diversify repeated works,
  concepts, and relation kinds.
- Record target structural order and spoiler-risk signals. Apply current
  reading progress at render time rather than baking mutable progress into the
  derived artifact.
- Invalidate one work's reader index when its units, graph links, or curation
  change without rebuilding unrelated source books.
- Never perform embedding search or generative inference because a paragraph
  scrolled into view.

### Proposed connection shape

```json
{
  "connectionId": "echo_<stable-pair>",
  "source": { "workId": "work_a", "unitId": "unit_a", "paragraphId": "paragraph_a" },
  "target": { "workId": "work_b", "unitId": "unit_b", "paragraphId": "paragraph_b" },
  "relation": "dramatizes",
  "confidence": 0.91,
  "explanation": "This scene dramatizes the mechanism described in the related passage.",
  "spoiler": { "risk": "medium", "reason": "late-plot-event" },
  "evidence": { "sourceQuoteHash": "sha256:…", "targetQuoteHash": "sha256:…" },
  "generatedBy": { "graph": "library-idea-links-v2", "model": "…" }
}
```

### Exit gate

- Opening or scrolling a processed book performs no library-wide inference.
- A stale/missing reader index removes indicators rather than blocking Native
  reading.
- Rebuilds preserve hidden/wrong labels and other canonical user curation.

---

## Phase 5 — Native-reader Echoes

**Outcome:** Ship the defining reader experience without overwhelming the
book.

### Work

- Add a discreet, non-textual indicator at the end of a paragraph only when at
  least one eligible Echo exists.
- Add `Off`, `Indicators`, and `Indicators + asides` controls globally and as a
  per-book override. The recommended first-release default is `Indicators`
  only after Background Intelligence has been enabled.
- Open an accessible card/sidecar with:
  - relation-aware title and bounded explanation;
  - current and target source excerpts;
  - work title and location;
  - open related passage and return-to-origin actions;
  - hide, unhelpful, wrong, and spoiler controls;
  - provenance/details disclosure.
- Preserve page-navigation shortcuts and reader context while the Echo surface
  is open.
- Conceal target evidence beyond known reading progress unless revealed.
- Bound indicator density and group multiple connections behind one mark.
- Provide keyboard activation, focus return, screen-reader labels, reduced
  motion, touch targets, and high-contrast states.
- Keep generated explanations visually distinct from authored text and exclude
  them from copy/export unless explicitly selected.
- Add a work/library exclusion control for readers who do not want a source to
  participate in Echoes.

### Exit gate

- Indicators never alter paragraph text or reading positions.
- Turning Echoes off removes all Echo UI immediately and stops no core reading
  behavior.
- Navigation to a related passage and back is deterministic in standalone and
  NakliOS modes.
- No automatic popover, audio, or network request occurs on scroll.
- Accessibility and keyboard contracts pass across supported Chromium and
  Firefox modes.

---

## Phase 6 — Optional spoken Echoes

**Outcome:** Let a reader hear a grounded connection without making TTS a
dependency of semantic matching.

### Work

- Add “Speak this connection” through a small TTS adapter.
- Prefer available system/browser voices; keep future host/local TTS routes
  behind the same adapter.
- Read the generated explanation first. Source excerpts require a separate
  action and identify their work before playback.
- Support play, pause, stop, rate, and focus-safe cancellation.
- Never begin speaking automatically when an indicator appears.

### Gate

This phase remains optional until TTS is ranked within the reader-depth batch.
Its absence cannot delay visual Echoes.

---

## Phase 7 — Executor parity, scale, and recovery

**Outcome:** Produce the same portable Echo artifacts in the browser and native
indexer while keeping reading responsive.

### Work

- Implement the paragraph, unit, relation, and reader-index schemas in
  `scripts/books-index.py` and the browser executor.
- Compare normalized records, IDs, evidence, relations, and connection IDs—not
  only counts.
- Add incremental invalidation for one changed/renamed/missing work.
- Exercise pause/resume, executor lease contention, battery/Data Saver yield,
  worker crash, provider failure, and partial derived writes.
- Benchmark cold/warm processing and vector/connection storage at 40, 1,000,
  and synthetic 10,000-book scales.
- Verify Browser, standalone Folder, NakliOS Folder, and Crate isolation.
- Verify clearing and rebuilding all Echo artifacts preserves sources, reading
  state, annotations, and curation overlays.

### Exit gate

- Browser/native fixtures agree on schemas and stable identities.
- A known book remains openable throughout processing and graph rebuilds.
- Interrupted writes recover from the last completed generation.
- Existing scale and reading-responsiveness contracts do not regress.

---

## Phase 8 — Real-library quality gate and rollout

**Outcome:** Enable Echoes because they are useful, not merely because the
pipeline can generate them.

### Work

- Label query relevance, unit precision, relation correctness, explanation
  grounding, connection novelty, repetition, and spoiler safety on the real
  collection.
- Report fiction↔fiction, nonfiction↔nonfiction, and cross-genre results
  separately.
- Tune candidate, classification, and inline thresholds only through versioned
  quality-gate updates.
- Run a long processing soak while reading and opening Echo cards.
- Add feedback summaries without uploading source text or user judgments.
- Release behind an explicit Background Intelligence opt-in, then measure
  hides/wrong labels locally before considering a broader default.

### Next execution batch — Connection Calibration & Explorer

> **State:** Engineering complete. The stratified queue, portable judgments,
> review/search-check workspace, quality report, library explorer, and exact
> source routes are implemented and verified by automated contracts. Human
> usefulness judgments and the default-rollout decision remain the release
> gate and must not be inferred by a model or fabricated by automation.

This is the next active Echoes batch. It turns the functioning production
graph into a calibrated, inspectable library experience without enabling
inline connections by default prematurely.

#### 8.1 — Portable evaluation queue

- Build a deterministic, versioned review queue from the production Echo
  graph rather than reviewing whichever high-scoring pairs happen to appear
  first.
- Stratify the initial queue across fiction↔fiction,
  nonfiction↔nonfiction, nonfiction↔fiction, likely false positives,
  repeated/generic concepts, and spoiler-sensitive targets.
- Target an initial review set of approximately 200 diverse connection pairs
  and 25–40 representative library-search queries. Sampling must limit
  repeated works, concepts, and relation kinds.
- Store evaluator judgments separately from generated graph records. The
  portable evaluation record must retain connection/link IDs, graph and
  extractor versions, evidence hashes, evaluator labels, timestamps, and any
  relation override without copying entire books.
- Support at least: `useful`, `obvious`, `weak`, `wrong`, `repetitive`, and
  `spoiler-sensitive`, plus evidence-validity and suggested-relation fields.
- Preserve existing reader feedback (`hide`, `unhelpful`, `wrong`, `spoiler`,
  and work exclusion) as canonical user curation; evaluation labels are a
  quality corpus and do not silently rewrite user preferences.

#### 8.2 — Connections Review workspace

- Add a library-level review surface that presents the two source passages
  side by side with book, location, unit kind, relation, confidence, spoiler
  state, and generation provenance.
- Provide fast keyboard-accessible labeling, skip/defer, exact source opening,
  return-to-review, progress, filters, and a resumable place in the queue.
- Make missing or stale evidence explicit. A reviewer must never be asked to
  judge a generated explanation when either source passage cannot be
  resolved.
- Export a privacy-safe quality report and the portable judgment record; do
  not export source passages unless the user explicitly chooses an
  evidence-inclusive local file.

#### 8.3 — Calibration and noise suppression

- Report precision, evidence validity, novelty, repetition, spoiler safety,
  and label distribution separately for all three genre directions.
- Identify and suppress low-value generic concepts, vocabulary-only matches,
  duplicate editions/passages, and one-book or one-theme domination.
- Tune candidate, classification, work-details, search, and stricter inline
  thresholds independently. Every change must update
  `SEMANTIC-QUALITY-GATE.md`, increment the relevant derived-artifact version,
  and preserve portable curation.
- Compare the deterministic baseline with optional model-assisted extraction
  and relation classification. A stronger model may improve ranking but
  cannot replace evidence checks or overwrite accepted human labels.
- Rebuild the full production collection after calibration and compare the
  new graph against the frozen pre-calibration report.

#### 8.4 — Library-wide Ideas & Connections explorer

- Promote the existing graph beyond per-book details into a first-class
  library surface for themes, connected works, contrasting arguments, and
  concept-to-story examples.
- Begin with navigable theme trails, ranked evidence cards, and book clusters;
  do not make an unstructured force-directed “hairball” graph the primary
  interface.
- Every visible relationship must open evidence in both works and expose its
  relation, confidence, provenance, spoiler state, and available user
  curation.
- Reuse the same graph, units, review labels, and exact-passage routes as
  hybrid search and reader Echoes. Do not create a second semantic truth
  layer for the explorer.
- Keep hidden concepts, excluded works, wrong links, and backend boundaries
  consistent across Book details, search, the explorer, and Native reading.

#### 8.5 — Beta rollout and soak

- Run a complete background-processing and graph-rebuild soak while reading,
  searching, opening Echo cards, and switching books.
- Verify the review workspace, explorer, and reader routes in standalone and
  NakliOS modes, including keyboard, small viewport, Firefox fallback, worker
  failure, cancellation, and missing derived artifacts.
- Release the explorer and indicator-only Echoes behind explicit Background
  Intelligence opt-in once the labeled gate passes.
- Keep `Indicators + asides` separately opt-in. No connection may interrupt
  reading, appear automatically as a popover, speak automatically, or trigger
  inference on scroll.

#### Human boundary

The following work can be completed unattended: queue generation, portable
schemas, review UI, report generation, explorer UI, exact navigation,
calibration tooling, rebuilds, and automated verification. A human reader must
still label the representative pairs and queries, assess whether the results
are surprising or useful, approve threshold changes, and decide whether
indicator-only Echoes may become the recommended setting.

#### Engineering delivery ledger

- [x] Deterministic, bounded pair/query queue with genre, noise, and spoiler
  strata plus curation exclusions.
- [x] Portable, privacy-safe connection and query judgments with progress,
  conflict-safe merging, export/import, and derived-rebuild survival.
- [x] Accessible four-tab Ideas & connections workspace: explorer, pair
  review, search checks, and quality report.
- [x] Side-by-side source evidence with relation, score, confidence, location,
  spoiler state, and deterministic/model-assisted provenance.
- [x] Exact source navigation in either work and a stable return route to the
  prior review/query state.
- [x] Browser and native quality reporting, advisory-only threshold hooks,
  guide coverage, and standalone/NakliOS regression journeys.
- [ ] Label the representative real-library pairs and queries, approve any
  calibrated version change, and record the rollout setting. This is the
  intentionally human gate.

#### Batch exit gate

- The initial stratified pair and query targets are reviewed with no unresolved
  evidence pointers in accepted results.
- 100% of displayable connections retain valid evidence in both works and no
  known high-risk spoiler is revealed by default.
- Quality results are reported separately by genre direction, relation,
  deterministic/model-assisted route, and product surface.
- Generic, repetitive, and vocabulary-only connections meet the versioned
  suppression gate established from the labels.
- Browser and native rebuilds agree on identities and accepted labels survive
  regeneration.
- The explorer, exact related-passage route, return route, and opt-out behavior
  pass standalone and NakliOS browser journeys.
- The default remains `Off` until the human-reviewed inline threshold is met
  and the rollout decision is recorded explicitly.

### Initial acceptance criteria

- 100% of displayed Echoes retain valid evidence in both works.
- No known prompt-injection fixture changes the extraction/classification
  contract or IDs.
- Inline precision meets the stricter labeled threshold established in Phase
  0; search/work-details may use lower, visibly distinct thresholds.
- Cross-genre evaluation includes useful `dramatizes`, `illustrates`, or
  `embodies` examples—not only broad `echoes` links.
- No unrevealed high-risk target passage is exposed by default.
- Reading, navigation, and interactive AI remain responsive during a full
  background run.
- Standalone and NakliOS production smokes complete without console errors.

## Testing map

- Unit tests: paragraph IDs, normalization, schemas, relation compatibility,
  thresholds, spoiler gates, density, and stable IDs.
- Contract tests: browser/native parity, rebuild/invalidation, curation
  survival, and backend isolation.
- Quality fixtures: positive/borderline/negative pairs across all three genre
  directions.
- Security fixtures: instruction-like book text, malicious HTML, unknown IDs,
  oversized model output, and provider failure.
- UX tests: keyboard, screen reader, focus return, small viewport, reader
  navigation, toggle states, and no inference on scroll.
- Scale tests: bounded candidate generation, artifact size, warm diff, and one
  changed work in a large library.
- Production smoke: standalone Native reader and Lorewell hosted inside
  NakliOS.

## Decisions deliberately deferred until evidence exists

- Whether labeled real-library evidence supports changing the initial `Off`
  setting to `Indicators`; automatic asides remain off by default.
- Whether a stronger provider may rerank automatically after explicit consent,
  or only on demand.
- Faithful-reader overlays beyond a sidecar presentation.
- Concept maps, journeys, recaps, illustrations, and other later consumers of
  the Echo graph.

`Echoes`, the quiet `◌` indicator, on-demand browser speech, conservative
spoiler concealment, and an initial `Off` setting are the release-candidate
defaults. None of the remaining
decisions blocks paragraph anchors, typed units, candidate retrieval, evidence
schemas, or the quality corpus.
