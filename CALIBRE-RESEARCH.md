# Calibre feature inventory — Books benchmark

> **Lifecycle:** `research` — captured 2026-07-30 from Calibre's official
> website and Calibre 9.11.0 manual.
>
> **Planning status:** Consumed as input to
> [SEMANTIC-LIBRARY-SPEC.md](SEMANTIC-LIBRARY-SPEC.md) and
> [SEMANTIC-LIBRARY-WORKPLAN.md](SEMANTIC-LIBRARY-WORKPLAN.md). The Phase 0
> Adopt / Adapt / Reject decisions remain pending; none of the comparison
> features is approved merely by appearing here.

## Purpose

Calibre is a useful benchmark, but it is not a specification for Books.
Calibre is a desktop e-book manager, conversion suite, editor, device bridge,
content server, and reader. Books is currently a browser-native, local-first
reader that also runs inside NakliOS.

The Phase 0 job is to classify the inventory below:

- **Adopt** — the user need and interaction fit Books directly.
- **Adapt** — keep the user value, redesign it for a browser/local-first app.
- **Reject** — intentionally leave it to Calibre or another specialist tool.

## Official feature inventory

### 1. Library ingestion and catalog management

Calibre can:

- Add individual files, whole folders, recursive folder trees, and multiple
  books contained in ZIP/RAR/7z archives.
- Create empty book records, add records from ISBNs, and attach new formats or
  arbitrary supporting data files to an existing record.
- Read metadata from book files and infer it from filenames.
- Keep multiple formats under one logical book record.
- Manage multiple physical libraries and filtered **Virtual libraries**.
- Browse through list, cover-grid, cover-browser, and bookshelf views.
- Organize by authors, tags, series, publishers, ratings, languages, and custom
  columns; expose these dimensions through a tag browser and quick views.
- Save searches, temporarily mark records, run background jobs, and generate
  library catalogs.

**Books today:** file-per-book flat libraries, scan-on-load discovery, cover
rows, filtering, sorting, Continue Reading, and separate Browser/Folder/Crate
backends. It does not yet have a canonical catalog database, shelves, virtual
libraries, custom fields, or multi-format grouping.

### 2. Metadata and covers

Calibre can:

- Edit title, authors and author-sort values, series, publisher, tags, rating,
  language, identifiers, comments/description, dates, and covers.
- Define custom metadata columns.
- Fetch metadata and covers from online providers, including title, author,
  series, tags, rating, description, and ISBN.
- Edit one book at a time or apply bulk edits, bulk downloads, regular
  expression replacements, and field-to-field copies.
- Merge duplicate book records and manage all formats attached to a record.
- Download, paste, crop/trim, replace, or generate a basic cover.
- Attach arbitrary extra data files to a book.
- Add rich notes, including links and images, to authors, tags, series, and
  other category values.

**Books today:** lazily extracted title/author, a cached or fallback cover, and
one JSON sidecar per source filename. Rich metadata, provider downloads, bulk
editing, duplicate merging, and work-level records are open design space.

### 3. Library search and organization

Calibre provides:

- Structured search across metadata fields, saved searches, sorting, and
  query-driven Virtual libraries.
- Full-text search across the contents of the entire library.
- A tag browser that narrows authors, series, publishers, tags, ratings, and
  other fields together.
- Current full-text results presented in either compact or cover-card views.

**Books today:** library filtering covers title, author, and filename; in-book
search works across the Foliate, PDF, and text engines. Cross-library full-text
search and saved/structured queries remain deferred.

### 4. Reader and navigation

Calibre's viewer includes:

- Major reflowable e-book formats, with paged and continuous-flow modes.
- Position restoration, bookmarks, Table of Contents, location navigation,
  browser-like Back/Forward history, and links that open a book at a precise
  location.
- A reference mode that gives paragraphs stable section/paragraph numbers.
- Search modes for contains, whole words, nearby words, and regular
  expressions.
- Font, color, margin, page-count, stylesheet, header/footer, and reading
  profile customization; headers/footers can show chapter, position, and time
  remaining.
- Keyboard-only navigation, customizable shortcuts, full screen, auto-scroll,
  image zoom, copy, print-to-PDF, and paper-edition page-number mapping.
- Dictionary lookup with configurable online or local URL-based sources.
- Read Aloud through the local Piper neural engine or operating-system speech.

**Books today:** faithful Foliate/PDF/Text engines, saved position, bookmarks,
TOC/engine navigation, common in-book search, and core appearance profiles.
Paged/flow switching, reference locations, dictionaries, TTS, time remaining,
auto-scroll, print, and deeper accessibility controls are not yet present.

### 5. Highlights, notes, and annotations

Calibre can:

- Highlight selections with colors and attached notes.
- Show a per-book highlights panel and a library-wide annotations browser.
- Sync annotations between the desktop viewer and Content server viewer.
- Fetch some annotations from connected reading devices.
- Export annotations as a standalone searchable/filterable HTML page.

**Books today:** positional bookmarks plus one free-text note per book. Inline
highlights and a cross-library annotation surface are already deferred.

### 6. Format conversion and polishing

Calibre can:

- Convert many input formats into many output formats, one book at a time or
  in bulk, and automatically choose a device-compatible output.
- Normalize input through an intermediate XHTML pipeline before producing the
  target format.
- Adjust fonts, line heights, justification, paragraph spacing, margins,
  punctuation, character encodings, and page/device profiles.
- Apply CSS/HTML transforms, heuristic cleanup, search/replace, structure and
  chapter detection, and Table of Contents generation.
- Embed or subset fonts, linearize problematic layouts, and expose conversion
  debug artifacts at each pipeline stage.
- Run lower-impact `ebook-polish` operations without a full edit/conversion.

**Books today:** reads source formats without producing converted files.
Conversion is a separate product-sized capability and should not be assumed to
belong in the browser app.

### 7. E-book editing and comparison

Calibre has an integrated EPUB/KEPUB/AZW3 editor with:

- HTML/CSS/source editing, syntax highlighting, autocomplete, snippets, and
  live book/CSS previews.
- File and asset management, including images, fonts, stylesheets, ordering,
  splitting, merging, replacement, and export.
- Search/replace across files, saved searches, and programmable function mode.
- Automated Table of Contents, cover, font, CSS, HTML, semantics, punctuation,
  cleanup, validation, spelling, and external-link tools.
- Checkpoints in addition to undo/redo, plus reports and e-book comparison.

**Books today:** deliberately a reader; it does not mutate authored book
content. An editor should be treated as a distinct product direction.

### 8. E-reader devices and delivery

Calibre can:

- Detect and support many dedicated e-readers over cable or wireless
  connections.
- Send books to device memory or storage cards, optionally converting to the
  best format first.
- Treat a normal folder as a device and customize transferred filenames and
  directory layouts through templates.
- Inspect device contents, eject devices, delete matching books, and
  experimentally retrieve annotations.
- Deliver books and scheduled news by email.

**Books today:** its storage backends are Browser, NakliOS Folder, and encrypted
Crate. Hardware-device drivers and USB/MTP management do not naturally fit a
normal web application.

### 9. Content server, remote access, and offline use

Calibre's Content server can:

- Expose one or more libraries through a browser with book metadata, reading,
  and downloads.
- Provide cover-grid/list browsing, search, sorting, and Virtual libraries.
- Cache books for offline reading and, over HTTPS, operate as an installable
  PWA with full offline mode.
- Synchronize last-read position and annotations across its browser clients.
- Protect access with user accounts and permissions and sit behind a reverse
  proxy.

**Books today:** the standalone Worker is a web application, but its library
stays in that browser origin; NakliOS Folder/Crate storage supplies a different
local/private model. Cross-device serving and synchronization need an explicit
sovereign-data design, not a direct Calibre clone.

### 10. News and web-content acquisition

Calibre can:

- Fetch hundreds of news and magazine sources and turn them into e-books.
- Schedule downloads per source and automatically send the result to a
  connected device.
- Consume RSS and user-authored site recipes, with an API for custom sources.
- Use `web2disk` for command-line web acquisition.

**Books today:** sideloads user-provided files and performs no feed acquisition.
This is likely a separate reading-inbox product question.

### 11. Portability, recovery, and safe library operations

Calibre can:

- Save books back to disk with formats and OPF metadata so they can be
  re-imported without losing catalog information.
- Import/export and back up entire libraries, move/copy between libraries, and
  run library maintenance and database restoration.
- Preserve recently deleted books/formats temporarily so deletion can be
  undone.
- Run portably from removable storage.

**Books today:** local canonical files plus sidecars, orphan recovery, explicit
deletion confirmation, and backend isolation. Export/backup, reversible trash,
library validation, and metadata-portable bundles deserve comparison.

### 12. Extensibility, automation, and current AI features

Calibre exposes:

- Plugins for UI, conversion, import processing, metadata, device drivers, and
  other subsystems, plus downloadable community plugins and icon themes.
- User-authored news recipes, templates, tweaks, custom resources, and a
  `calibre://` URL scheme.
- Command-line programs for the database, server, SMTP, conversion, editing,
  metadata, polishing, viewing, metadata fetching, and web capture.
- Current AI features for asking about selected text, discussing books in the
  library, and requesting similar-book suggestions. Calibre also lists an LM
  Studio plugin for local models.

**Books today:** one hosted-only NakliOS AI reading companion and no extension
or automation API. The planned local concept metadata and illustrated native
reader are separate future work, not Calibre parity items.

## Important Calibre boundaries

- Calibre is a **managed-library** system and normally copies imported files;
  Books currently presents each backend's existing files as canonical.
- Calibre is desktop-first and can use filesystem, USB/MTP, native processes,
  and a long-running local server. Some capabilities cannot be reproduced
  safely or honestly in an ordinary browser.
- Calibre does not convert DRM-protected books. This inventory does not imply
  DRM circumvention work for Books.
- Breadth is not automatically product quality. Books should retain its
  private, local-first, low-friction reading identity.

## Candidate comparison backlog — not approved

These are the most plausible clusters to evaluate during Phase 0:

1. **Library record and metadata model:** work-level identity, multiple formats,
   richer fields, metadata editing, and optional provider enrichment.
2. **Organization:** shelves or query-driven virtual libraries, tags/series,
   saved searches, and duplicate handling.
3. **Full-library search:** content indexing, result excerpts, and local index
   storage.
4. **Annotations:** inline highlights, annotation browser, export, and stable
   cross-engine anchors.
5. **Reader depth:** paged/flow modes, TTS, dictionary lookup, reference
   locations, profiles, accessibility, and time remaining.
6. **Library safety:** export/backup, validation, portable sidecars, reversible
   trash, and restore.
7. **Large separate bets:** conversion, editing, device drivers, Content
   server/sync, news acquisition, plugins, and CLI automation.

## Phase 0 decision worksheet

For every candidate cluster:

1. Classify it **Adopt / Adapt / Reject**.
2. Name the concrete user problem; do not approve a feature solely because
   Calibre has it.
3. Define the local-first and privacy boundary.
4. Check what works consistently across Browser, Folder, and Crate.
5. Decide whether it changes the book identity or sidecar schema.
6. Estimate bundle/runtime cost and whether it requires a server or native
   companion.
7. Place accepted work into a release sequence before implementation begins.

The extension spec answers the broad strategic question: Books grows into a
private semantic library. Phase 0 must still decide which library-management
capabilities are necessary to make that direction useful, and which parts of
Calibre remain distraction.

## Official sources

- [Calibre feature overview](https://calibre-ebook.com/about)
- [Calibre 9.11.0 user manual](https://manual.calibre-ebook.com/)
- [Graphical interface and library-management actions](https://manual.calibre-ebook.com/gui.html)
- [Metadata editing](https://manual.calibre-ebook.com/metadata.html)
- [Virtual libraries](https://manual.calibre-ebook.com/virtual_libraries.html)
- [E-book viewer](https://manual.calibre-ebook.com/viewer.html)
- [Conversion system](https://manual.calibre-ebook.com/conversion.html)
- [E-book editor](https://manual.calibre-ebook.com/edit.html)
- [Content server](https://manual.calibre-ebook.com/server.html)
- [Customization and plugins](https://manual.calibre-ebook.com/customize.html)
- [Command-line interface](https://manual.calibre-ebook.com/generated/en/cli-index.html)
- [Current release notes and newer features](https://calibre-ebook.com/whats-new)
