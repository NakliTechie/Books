# Books AI provider and privacy boundary

Status: implemented foundation, 2026-07-30.

Books remains a complete local reader and lexical-search library when AI is
disabled or unavailable. AI is an optional capability layer; it is never the
authority for the original file, work identity, annotations, reading position,
or deterministic index.

## Provider routes

Inside NakliOS, Books sends model requests only through the host-mediated
`naklios.ai` broker. The host owns provider selection and consent.

Standalone Books supports an explicitly configured OpenAI-compatible endpoint:

- A **local service** may use HTTP or HTTPS. Its endpoint and model are visible
  before use.
- A **remote BYOK service** must use HTTPS and requires consent tied to the
  exact destination origin and approved capabilities.
- Credentials cannot be embedded in the endpoint URL.

The endpoint, model, provider class, and enabled state live in origin-scoped
`localStorage`. An API key lives only in `sessionStorage`; closing the browser
session removes it. A destination change clears the session key. Keys are
excluded from Books records, exports, prompts, and console messages.

## Content transmission

No book text is transmitted merely by opening, importing, indexing, searching,
or reading a work.

For **Ask library**, Books first performs lexical retrieval against the local
passage index. Only the retrieved excerpts, scope label, and current question
are sent after the user chooses Ask. A remote route must have explicit
destination-specific consent for `answerFromSources`.

For the **reader companion**, the user explicitly chooses Explain, Summarize,
Key points, or asks a question. Only the current selection/page/passage and the
request are sent.

Source text is marked as untrusted quoted data. Prompts instruct the model not
to follow instructions embedded in a book. Ask answers must cite the supplied
passage identifiers (`[S1]`, `[S2]`, …); invented or missing citations make the
result visibly unverified.

## Provenance

Each completed model-assisted Ask or reader request writes a
`semantic/ai-runs/airun_*.json` record when persistent storage is available.
The record contains:

- capability and prompt version;
- provider class, visible model, and destination (never a secret);
- consent class;
- hashes of prompt configuration and the user's request;
- source work, passage, and quote-hash evidence;
- model output and validation result.

Ask citations open the exact source passage in the faithful reader. Reader
requests are linked to the indexed passage when Books can resolve it; an
unresolved run is recorded as invalid rather than presented as verified
provenance.

Portable library exports intentionally omit AI run records and all provider
configuration. The source books, portable work metadata, annotations, and
deterministic semantic records remain usable independently.

## Revocation and failure

Disabling or clearing the standalone provider immediately prevents new model
requests. Remote consent is revoked when the provider becomes local or is
disabled. Provider errors do not block reading, local search, Native mode,
annotations, backup, recovery, or Trash.

Model-assisted concept/scene enrichment and generated illustrations require
their own capability-specific consent and are not enabled by the
`answerFromSources` approval.
