# Books — Deferred decisions and access checks

> **Status:** Collected during autonomous roadmap execution. No response is
> needed until the implementation and evidence work is complete.

## Access-dependent verification

- [x] Chrome extension local-file access was enabled.
- [x] Cloudflare dashboard access and the named `naklitechie` Wrangler profile
  were reauthenticated and verified without replacing the default profile.
- [x] Background Intelligence was enabled for the production Browser library;
  the local MiniLM encoder downloaded and initialized.
- [x] A disposable recursive Folder under
  `~/Code/temp/books-folder-soak` completed add, repeated missing, and restored
  rename reconciliation. The exercise found and fixed an identity-duplication
  bug; a regression now covers the restored-after-gap case.
- [ ] A sync-managed/network Folder is not currently available. Defer its
  permission-loss, partial-write, conflict, and long-running soak matrix until
  the user has one.

## Product decisions

- [x] **OCR product defaults:** English/Latin PP-OCRv6 tiny is the first browser
  candidate, local PP-StructureV3 handles complex layouts, and hosted OCR is
  disabled. Runtime corpus and resource gates still block the production OCR
  queue; see `OCR-DECISION.md`.
- [x] **Metadata/cover provider:** Open Library is enabled only through an
  explicit per-book lookup, with bounded results, preserved provenance,
  courtesy links, no bulk calls, and a separate cover choice.
- **Illustrations:** choose purpose, visual style/consistency, cadence,
  provider/on-device route, safety/copyright posture, storage budget,
  regeneration, and whether generation is automatic or on demand.
- **Continuity:** select a sovereign sync transport before the existing
  version/tombstone/conflict contract receives a network implementation.
- **Backend movement:** approve the first Copy/Move slice and defaults in
  `LIBRARY-MOVEMENT-CONTRACT.md`.
- **Reader depth:** rank TTS, dictionaries, reading profiles, and deeper
  format-specific controls by desired launch priority.
- **Formats:** approve a dedicated CBZ/CBR or DjVu reader bet before adding its
  parser, position model, and UI.
- **Calibre-shaped bets:** conversion, polishing, news acquisition, store and
  device integration, plugins, and broad CLI automation remain separate bets.
