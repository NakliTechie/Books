# Books — Deferred decisions and access checks

> **Status:** Collected during autonomous roadmap execution. No response is
> needed until the implementation and evidence work is complete.

## Access-dependent verification

- Enable **Allow access to file URLs** for the ChatGPT Chrome extension before
  repeating the disposable localhost file-import smoke. Production standalone
  reading and the candidate NakliOS host regression already pass.
- Sign in to the Cloudflare dashboard in Chrome so its Git integration and
  resulting production build can be inspected there. Wrangler is currently
  authenticated to a different Cloudflare account than the `naklitechie.com`
  Worker.
- Turn on Background Intelligence when ready to download the local embedding
  model and build cross-book relationships. The production report is otherwise
  healthy; relationships are currently zero because semantic embeddings are
  disabled.
- Grant a real Folder (and, separately, a sync-managed/network Folder) for the
  mutation, permission-loss, partial-write, and long-running soak matrix.

## Product decisions

- **OCR:** choose the first default language/model pack and whether hosted OCR
  should be offered at all. The accepted local-first route and remaining
  corpus gate are in `OCR-DECISION.md`.
- **Metadata/cover provider:** approve licensing, attribution, caching,
  correction, and remote-destination policy before a provider is enabled.
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
