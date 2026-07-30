# Books-native reader contract

Status: implemented accessibility foundation, 2026-07-30.

Native mode is a reflowed view of Books' local passage representation. It is
never the authority for authored layout. Faithful mode remains the route for
the original EPUB section, PDF page geometry, HTML presentation, table,
mathematics, preformatted content, figure/media, note target, or link target.

## Source fidelity

Every native passage has a stable passage ID, a numbered reference, and a
visible “View authored source” action. That action reopens Faithful mode at the
best engine-specific anchor. Native mode shows a notice when extraction
detected structures whose authored presentation it cannot faithfully reflow;
their extracted text may remain visible, but the notice makes the limitation
explicit.

Scanned PDFs without a text layer never receive a fake Native representation.
Their processing job remains `waiting-for-ocr`, and Faithful PDF rendering
continues to work.

## Reading controls

Reflowable engines support:

- font size and line height;
- text width;
- book serif, system sans, and humanist sans stacks;
- natural-rag or justified alignment;
- paragraph spacing;
- system, paper, sepia, and night color profiles.

The defaults live in origin-local preferences. A persisted book may retain its
own current preference snapshot. PDF pages retain authored layout and do not
receive text-reflow overrides.

Native position includes the current passage ID, numbered reference, fraction,
and estimated minutes remaining at 230 words per minute. Mode switches retain
separate Faithful and Native positions and translate source jumps through
passage anchors.

## Accessibility

The Native viewport is a focusable document landmark labelled with the work
title. The article has a real heading hierarchy; each passage is a labelled
focus target and exposes `aria-current="location"` while active. Source actions
have reference-specific accessible names. Reader position is announced through
the shared status region.

Keyboard navigation preserves the existing reader contract:

- Left / Right and Space move through reading content.
- Command/Control-F opens in-book search.
- Escape closes search, then exits the reader.
- Input, textarea, and editable focus never trigger page movement.

Motion follows `prefers-reduced-motion`; smooth scrolling and nonessential
transitions become immediate when the operating system requests reduced
motion.

Source-grounded concept chips appear adjacent to their evidence passage and
never replace or cover source text. Universal highlights remain inline and use
the same portable annotation identities as Faithful readers.

## Derived-data lifecycle

Passages, indexes, semantic/model records, AI run history, processing
checkpoints, and cover thumbnails are rebuildable local data. Library tools
measure these separately from originals and portable records. Users can pause
processing or clear this derived set. Cleanup waits for active processing,
preserves byte-identical originals and user annotation identities, and resumes
the deterministic rebuild only when processing is enabled.
