# Lorewell Echoes — vision

> **Lifecycle:** `implemented vision` — the engineering foundation is shipped
> as a release candidate; real-library quality calibration is tracked in
> [ECHOES-WORKPLAN.md](ECHOES-WORKPLAN.md).
>
> **Date:** 2026-07-31

## The promise

Lorewell should reveal how an idea travels through a library.

A concept may be argued in one nonfiction book, challenged in another, and
dramatized by a character's choice in a novel. A plot pattern may recur in a
different story. A historical mechanism may illuminate a fictional conflict.
These connections should become available at the moment they are useful,
without interrupting reading or pretending that semantic similarity is proof.

We call these source-grounded connections **Echoes**.

An Echo is a typed, evidence-backed relationship between two parts of two
works. It always retains exact source passages from both books. Its short
explanation is derived metadata: inspectable, dismissible, rebuildable, and
never inserted into or mistaken for the authored text.

## The reading experience

In Lorewell's Native reader, a paragraph with a high-confidence connection can
end with a discreet indicator:

> The character chooses safety over truth.  ◌

Opening the indicator reveals a compact card:

> **An echo from _The Remains of the Day_**  
> Both passages show a character turning restraint into a moral virtue while
> avoiding a difficult choice.
>
> Current passage · Related passage · Open book · Speak

The reader remains in control:

- **Off** — no indicators or generated connection snippets.
- **Indicators** — discreet availability marks; explanations open on demand.
- **Indicators + asides** — selected high-confidence snippets may appear as
  quiet inline asides. This is never the default for a new reader.
- A connection can be hidden, marked unhelpful or wrong, or excluded by work.
- Spoiler-sensitive evidence remains concealed until explicitly revealed.
- Opening another book preserves a route back to the original paragraph.

Echoes begin in Native mode, where Lorewell owns stable paragraph rendering.
Faithful EPUB/PDF modes may later expose the same records in the AI sidecar or
as engine-specific overlays; they must not depend on fragile DOM mutation.

## What can connect

Echoes use one shared semantic layer while preserving the important
differences between fiction and nonfiction.

| Nonfiction unit | Fiction unit | Possible relationship |
|---|---|---|
| Concept | Motif | echoes, embodies |
| Claim | Character belief | illustrates, challenges |
| Mechanism | Character behaviour | dramatizes, applies to |
| Example or case | Scene | parallels, contrasts with |
| Consequence | Plot outcome | shares mechanism, contradicts |
| Counterargument | Reversal | challenges, offers a counterexample |
| Historical pattern | Conflict or arc | echoes, dramatizes |
| Principle | Character choice | embodies, violates, tests |

Connections also work within a genre:

- concept ↔ concept across nonfiction;
- claim ↔ supporting or contradicting claim;
- mechanism ↔ example;
- plot event ↔ plot event;
- motif ↔ motif;
- character choice ↔ a similar or contrasting choice.

The direction is useful both ways. While reading nonfiction, Lorewell can say
“this idea is dramatized in…”. While reading fiction, it can say “this scene
can be read through the concept of…”. At library level, the same records make
queries such as “show me where conformity appears as theory, history,
argument, or story” possible.

## Epistemic rules

The wording of a connection carries an epistemic promise.

- Fiction is never presented as empirical evidence for a nonfiction claim.
- A generated interpretation is not attributed to an author unless the source
  explicitly supports that attribution.
- `dramatizes`, `illustrates`, `echoes`, `can be read through`, and `offers a
  counterexample` are distinct from `proves` or `confirms`.
- `same plot`, `same mechanism`, and other strong relations require a higher
  evidence threshold than broad similarity.
- An uncertain relation is either labeled `related` or not shown. Lorewell
  fails closed rather than filling the page with plausible-sounding links.
- Every explanation can expose the source passage from both works, relation
  type, confidence band, extractor/model, and generation date.
- A model may propose a connection; it cannot change the book, annotations,
  or user-authored metadata.

## Semantic vocabulary

Each processed work emits small, typed **semantic units** rather than one
whole-book summary.

Nonfiction units include concepts, claims, mechanisms, principles, examples,
cases, arguments, counterarguments, consequences, and questions. Fiction
units include scenes, events, character choices, beliefs, relationship
dynamics, conflicts, reversals, consequences, motifs, and plot threads. Mixed
works can contain both.

Each unit contains:

- a stable unit identity and kind;
- a bounded statement suitable for embedding and comparison;
- one or more paragraph-level evidence anchors;
- confidence, provenance, extractor/model version, and user curation state;
- optional participants, qualifiers, time/order, and narrative role.

Relations are directed where meaning requires it. The initial relation set
extends the existing Lorewell graph with:

- `same_as`, `supports`, `contradicts`, `extends`, and `example_of`;
- `applies_to`, `shares_mechanism`, and `counterexample_to`;
- `illustrates`, `dramatizes`, `embodies`, `violates`, and `tests`;
- `parallels`, `contrasts_with`, and the deliberately weak fallback `echoes`.

## Intelligence architecture

The system is deliberately tiered so that one small model does not have to
“understand the whole library” in a single context.

1. **Parse and anchor.** Lorewell extracts sections, passages, paragraphs, and
   reversible source locations.
2. **Extract units.** Deterministic rules provide a baseline. An approved
   local/BYOK generative route can emit richer typed units from bounded source
   windows.
3. **Find candidates.** The compact local encoder places unit statements in a
   shared semantic space and retrieves a small number of cross-work neighbors.
4. **Classify pairs.** A small generative model examines only a candidate pair
   and its evidence, chooses a permitted relationship, assigns confidence, and
   drafts a short grounded explanation.
5. **Materialize for reading.** Lorewell ranks a bounded set of connections per
   paragraph and stores a rebuildable reader index. Scrolling never triggers
   library-wide inference.
6. **Render with context.** The reader applies user controls, current reading
   position, spoiler rules, hidden connections, and accessibility preferences.

The compact encoder is enough to discover candidates. Gemma 4 E2B, another
small on-device model, or a visible Ollama/LM Studio endpoint can perform
structured extraction and pair classification. A stronger local or BYOK model
may improve coverage or rerank ambiguity, but it is an enrichment route—not a
requirement for reading, lexical search, or the underlying library.

## Privacy and durability

- Core parsing, lexical indexing, and compact embeddings remain local.
- No remote provider receives text without its existing destination-specific
  consent and the separate Background Intelligence opt-in.
- Provider requests contain bounded cited passages, not whole books or an
  unbounded library dump.
- Folder libraries store canonical curation beside the books. Generated units,
  vectors, explanations, and reader indexes remain derived and rebuildable.
- Browser, Folder, Crate, and NakliOS storage remain separate; Echoes never
  silently merge libraries.
- Clearing derived intelligence removes Echoes without changing sources,
  reading positions, annotations, or user metadata.

## Spoilers and attention

Connections should deepen a reading session, not damage it.

- An Echo records the target passage's structural order and a spoiler-risk
  band.
- If the target is beyond the reader's known position in that work, the card
  reveals only safe metadata until the reader chooses to reveal it.
- Unread works receive the strictest default treatment.
- Plot outcomes, deaths, reversals, identities, and late-book resolutions are
  treated as high risk even when no reading history exists.
- Indicator density is bounded. Lorewell selects the strongest connection for
  a paragraph and keeps additional ones behind the same mark.
- No popover, audio, or aside opens automatically merely because a paragraph
  enters the viewport.

## Audio

“Speak this connection” is a presentation layer over the same grounded Echo.
It may use browser/native TTS and should read the explanation first, followed
by source excerpts only when requested. Audio is optional and cannot block the
initial visual Echoes release.

## Success looks like

Lorewell succeeds when:

- readers discover useful connections they would not have found by filename,
  tag, or keyword search;
- concept-to-concept, fiction-to-fiction, and cross-genre connections all work;
- every displayed Echo has accessible evidence in both books;
- users rarely encounter a wrong, trivial, repetitive, or spoiler-revealing
  suggestion;
- quiet indexing remains resumable and does not make reading brittle;
- small local models provide a useful baseline while stronger providers add
  depth rather than basic functionality;
- user feedback and curation survive regeneration;
- the feature remains valuable with all automatic snippets switched off.

## Non-goals for the first release

- Claiming to infer authorial intent.
- Generating a definitive literary analysis of a whole book.
- Displaying every embedding neighbor as a connection.
- Running inference during scroll or requiring a multi-gigabyte chat model to
  open a book.
- Making fiction evidence for factual claims.
- Mutating authored text or embedding generated prose in exported source files.
- Shipping illustrations, translation, or a full TTS system as dependencies of
  Echoes.

## Product horizon

The first release makes a small number of trustworthy connections visible in
Native reading. Later releases can add connection trails, concept maps,
library-wide thematic journeys, reading recaps, audio walks through related
ideas, and source-grounded illustrations. All of them should consume the same
typed units and evidence-backed graph rather than inventing a second semantic
system.
