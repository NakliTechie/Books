# Books semantic quality gate

> **Status:** Initial deterministic/browser-native calibration locked on
> synthetic evidence. Real-library labeling remains the release gate for
> changing these defaults.
>
> **Date:** 2026-07-30

This record makes the current semantic defaults visible and testable. They are
starting operating points, not universal quality claims.

## Locked initial defaults

| Surface | Default | Reason and guardrail |
|---|---:|---|
| Passage budget | 1,400 normalized characters | Keeps evidence and model context bounded while preserving paragraph boundaries when possible |
| Quote selector | First 240 characters + SHA-256 | Provides a portable reattachment hint without treating the excerpt as identity |
| Concepts per work | 16 | Prevents frequency extraction from turning details into an unbounded tag cloud |
| Evidence passages per concept | 4 | Keeps every concept inspectable while allowing repetition across a work |
| Section-opening scenes | 12 | Provides narrative/navigation candidates without claiming model-derived scene understanding |
| Cross-work link floor | cosine 0.68 | Candidate threshold only; a link remains evidence-backed and user-hideable |
| Links per idea | 8 | Bounds graph noise and work for each idea |
| Semantic containment | cosine 0.82 | Required before deterministic `extends` classification |
| Model relation acceptance | confidence 0.65 | Lower-confidence classifications cannot replace the deterministic relation |
| Hybrid retrieval | 72% semantic / 28% lexical | Passed the 12-query synthetic gate while preserving exact-term influence |

The browser exports these values as named constants. The native indexer has
matching named constants. Contract tests cover long-passage splitting,
concept/evidence bounds, low-confidence rejection, section-grounded scenes,
cross-executor link IDs, and the same relationship classification behavior.

## Evidence gate

The synthetic MiniLM benchmark requires:

- semantic and hybrid recall@3 of at least 90%;
- hybrid mean reciprocal rank of at least 0.85;
- every concept, scene, idea, and cross-book link to retain source passage
  evidence;
- the browser and native executor to agree on identity, normalized text,
  quote hashes, ranges, concepts, section scenes, and link IDs.

The recorded run in [BENCHMARKS.md](BENCHMARKS.md) passed the retrieval gate.
The checked-in executor parity fixture passes. These results prove the
mechanics and schema agreement, not the quality of extraction from a personal
library.

## Real-library recalibration

Before changing a default, label a representative set from the real
collection:

1. Query relevance at ranks 1, 3, 5, and 10.
2. Concept precision, duplicate/noise rate, and missing central concepts.
3. Evidence correctness and whether the cited passage is sufficient.
4. Relationship precision by type, with `related_to` measured separately.
5. Narrative scene usefulness versus section-opening fallbacks.
6. English and multilingual slices reported independently.

Store evaluator judgments separately from generated records. A threshold
change increments the relevant extractor/index version and invalidates only
derived artifacts. User labels, hides, merges, annotations, and source files
remain untouched.

## Connection calibration contract

Lorewell materializes a rebuildable, deterministic queue at
`indexes/echo-review-queue.json`. `echo-review-queue-v1` samples valid
evidence pairs across fiction↔fiction, nonfiction↔nonfiction, cross-genre,
likely-false-positive, generic/repetitive, and spoiler-sensitive strata while
bounding repeated works and relation kinds. It also creates a balanced set of
library-query checks. Hidden links and excluded works never enter the queue.

Human judgments live separately at `annotations/echo-evaluations.json` as
`echo-evaluations-v1`. A connection row retains stable review/link IDs, graph
version, direction, relation, score, evidence hashes, compact
extractor/classifier provenance, evidence validity, label, optional relation
suggestion, note, and timestamp. A query row retains the bounded query, label,
relevance-at-1/3 checks, note, and timestamp. Neither record contains source
excerpts or result passages.

The in-app and native CLI report the same `echo-quality-report-v1`: accepted
precision, invalid evidence, label/direction/relation/route distributions,
score bins, search relevance, and remaining review counts. Once enough labels
exist, Lorewell may calculate an advisory inline threshold, but it never
applies that threshold automatically. The current inline floor remains `0.82`
and Echoes remains Off by default until a human approves a versioned change.

The engineering gate is covered by deterministic unit tests, portable import
validation, and standalone/NakliOS browser journeys through the explorer,
side-by-side review, exact source opening, return, query check, and report.
The product gate remains the representative real-library labels and explicit
rollout decision.
