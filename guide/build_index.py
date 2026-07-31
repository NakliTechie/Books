#!/usr/bin/env python3
"""Build the Lorewell HTML guide from authored section and caption data."""

from __future__ import annotations

import html
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GUIDE = ROOT / "guide"

CAPTIONS = {
    "private-start": (
        "Private from the first screen",
        "Lorewell has no account gate: an anonymous visitor starts with a local, empty library and a clear statement of what stays on this device.",
    ),
    "add-your-library": (
        "Add a book or an entire folder",
        "Start with individual files, drag-and-drop, or grant a folder so Lorewell can discover supported formats recursively.",
    ),
    "choose-library-location": (
        "Choose where the library lives",
        "Browser storage, a durable Folder sidecar, and NakliOS storage remain explicit, isolated libraries—switching never silently copies or deletes.",
    ),
    "library-home": (
        "A work-centred library",
        "Continue Reading, one search, and Add lead; saved views and library-wide maintenance stay one deliberate step away.",
    ),
    "views-and-filtering": (
        "Views that remember how you think",
        "Combine reading state, shelves, tags, text filtering, and sort order, then save that view inside the active library.",
    ),
    "book-details": (
        "Metadata with provenance",
        "Edit title, authors, ISBN, tags, shelves, rating, formats, concepts, and processing state without modifying the original book.",
    ),
    "safety-and-portability": (
        "Inspectable, repairable storage",
        "Validate canonical records, rebuild disposable indexes, export a portable library, inspect background work, and recover books from Trash.",
    ),
    "ask-the-library": (
        "Ask across your own sources",
        "Lorewell retrieves passages locally first and requires the answer to cite the exact excerpts supplied to the chosen provider.",
    ),
    "ai-providers": (
        "Local AI, local endpoints, or BYOK",
        "Use the built-in on-device model, Ollama, LM Studio, or an explicit remote endpoint with session-only keys and destination-specific consent.",
    ),
    "faithful-reader": (
        "Read the authored source faithfully",
        "The primary reader preserves the book’s own structure on a full canvas while keeping the library available from the top bar.",
    ),
    "native-reader": (
        "A Lorewell native reflow",
        "Native mode reflows indexed passages into an accessible reading surface with stable references and source-grounded concepts.",
    ),
    "find-in-book": (
        "One search gesture across formats",
        "Find in book uses engine-aware anchors for EPUB, PDF, and reflowable text while retaining a common keyboard and result interface.",
    ),
    "notes-and-bookmarks": (
        "Reading memory beside the page",
        "Bookmarks, portable highlights, a table of contents, and per-book notes stay attached to the source and survive derived-index rebuilds.",
    ),
    "reading-appearance": (
        "Typography tuned for sustained reading",
        "Adjust typeface, size, rhythm, width, alignment, spacing, and colour profile without changing the book itself.",
    ),
    "ai-reading-companion": (
        "A private passage sidecar",
        "Explain, summarize, extract key points, or ask a question about the current passage without turning AI into a blocking reader modal.",
    ),
    "hosted-library": (
        "The same app inside NakliOS",
        "Lorewell keeps its standalone reading model when hosted, while storage, theme, and AI capabilities arrive through the NakliOS boundary.",
    ),
    "isolated-storage": (
        "Folder and Crate stay separate",
        "Hosted readers can switch between connected backends after pending reading state is saved; neither library is merged implicitly.",
    ),
}

SECTIONS = (
    (
        "visitor",
        "Anonymous visitor",
        "Lorewell is useful before sign-in because there is no sign-in. The browser is the private boundary.",
        ("private-start",),
    ),
    (
        "first-run",
        "Brand-new reader",
        "The first-run path explains both the fastest start and the more durable folder-backed library.",
        ("add-your-library", "choose-library-location"),
    ),
    (
        "library-owner",
        "Library owner",
        "Once populated, the collection becomes an active private knowledge space rather than a grid of inert files.",
        (
            "library-home",
            "views-and-filtering",
            "book-details",
            "safety-and-portability",
            "ask-the-library",
            "ai-providers",
        ),
    ),
    (
        "active-reader",
        "Active reader",
        "The reading surfaces keep source fidelity, personal memory, reflow, and optional assistance in one continuous workspace.",
        (
            "faithful-reader",
            "native-reader",
            "find-in-book",
            "notes-and-bookmarks",
            "reading-appearance",
            "ai-reading-companion",
        ),
    ),
    (
        "naklios-reader",
        "NakliOS reader",
        "Inside NakliOS, Lorewell adopts host capabilities without losing the standalone product or crossing storage boundaries.",
        ("hosted-library", "isolated-storage"),
    ),
)


def screenshot_for(role: str, slug: str) -> str:
    candidates = sorted((GUIDE / "screenshots" / role).glob(f"*-{slug}.png"))
    if not candidates:
        raise FileNotFoundError(f"Missing screenshot for {role}/{slug}")
    return candidates[0].relative_to(GUIDE).as_posix()


def build() -> str:
    toc = []
    sections_markup = []
    total = 0
    for role, title, intro, slugs in SECTIONS:
        toc.append(
            f'<a href="#{html.escape(role)}"><span>{html.escape(title)}</span>'
            f"<small>{len(slugs)} feature{'s' if len(slugs) != 1 else ''}</small></a>"
        )
        cards = []
        for slug in slugs:
            feature_title, caption = CAPTIONS[slug]
            screenshot = screenshot_for(role, slug)
            search = f"{title} {feature_title} {caption} {slug}".lower()
            cards.append(
                f"""
                <article class="feature-card" id="{html.escape(slug)}"
                         data-search="{html.escape(search, quote=True)}">
                  <a class="shot-link" href="{html.escape(screenshot)}"
                     aria-label="Open full-size screenshot: {html.escape(feature_title)}">
                    <img src="{html.escape(screenshot)}"
                         alt="{html.escape(feature_title)} in Lorewell"
                         loading="lazy" width="1400" height="900">
                  </a>
                  <div class="feature-copy">
                    <p class="eyebrow">{html.escape(title)}</p>
                    <h3>{html.escape(feature_title)}</h3>
                    <p>{html.escape(caption)}</p>
                  </div>
                </article>
                """
            )
            total += 1
        sections_markup.append(
            f"""
            <section class="role-section" id="{html.escape(role)}">
              <div class="role-heading">
                <p class="role-number">{str(len(sections_markup) + 1).zfill(2)}</p>
                <div><h2>{html.escape(title)}</h2><p>{html.escape(intro)}</p></div>
              </div>
              <div class="feature-grid">{''.join(cards)}</div>
            </section>
            """
        )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="A searchable, role-driven visual guide to Lorewell.">
<title>Lorewell — Visual Guide</title>
<style>
:root {{
  --body:#e8d9b3; --panel:#f3e7c4; --ink:#2c3e3a; --brand:#b85c3a;
  --row:#ddc89a; --muted:#705d47; --line:#c9b582;
  --shadow:0 20px 55px rgba(44,62,58,.13);
}}
* {{ box-sizing:border-box; }}
html {{ scroll-behavior:smooth; }}
body {{
  margin:0; color:var(--ink); background:
    linear-gradient(rgba(184,92,58,.045) 1px,transparent 1px),
    linear-gradient(90deg,rgba(184,92,58,.045) 1px,transparent 1px),
    var(--body);
  background-size:36px 36px;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",sans-serif;
}}
a {{ color:inherit; }}
.hero {{
  min-height:68vh; display:grid; align-content:end; padding:clamp(28px,7vw,96px);
  border-bottom:1px solid var(--line); position:relative; overflow:hidden;
}}
.hero::after {{
  content:"L"; position:absolute; right:-.04em; top:-.28em;
  font:900 min(70vw,720px)/1 Georgia,serif; color:rgba(184,92,58,.075);
  pointer-events:none;
}}
.hero-inner {{ position:relative; z-index:1; max-width:970px; }}
.kicker,.eyebrow {{
  color:var(--brand); font-size:11px; font-weight:750; letter-spacing:.13em;
  text-transform:uppercase;
}}
h1 {{ margin:.2em 0 .22em; max-width:900px; font:700 clamp(52px,8vw,112px)/.9 Georgia,serif; }}
.lede {{ max-width:760px; margin:0; color:var(--muted); font:400 clamp(17px,2vw,25px)/1.5 Georgia,serif; }}
.hero-meta {{ display:flex; gap:8px; flex-wrap:wrap; margin-top:28px; }}
.hero-meta span {{ padding:7px 10px; border:1px solid var(--line); border-radius:999px; background:rgba(243,231,196,.62); font-size:12px; }}
.search-wrap {{
  position:sticky; top:0; z-index:20; padding:12px clamp(18px,5vw,72px);
  border-bottom:1px solid var(--line); background:rgba(243,231,196,.94);
  backdrop-filter:blur(18px); display:flex; align-items:center; gap:12px;
}}
.search-wrap label {{ flex:1; position:relative; }}
.search-wrap input {{
  width:100%; min-height:46px; padding:10px 44px 10px 15px;
  border:1px solid var(--line); border-radius:9px; background:var(--body);
  color:var(--ink); font:15px inherit; outline:none;
}}
.search-wrap input:focus {{ border-color:var(--brand); box-shadow:0 0 0 3px rgba(184,92,58,.14); }}
.search-wrap kbd {{ position:absolute; right:12px; top:12px; border:1px solid var(--line); border-radius:4px; padding:2px 6px; color:var(--muted); background:var(--panel); }}
.app-link {{ white-space:nowrap; text-decoration:none; padding:11px 14px; border-radius:8px; background:var(--brand); color:var(--panel); font-weight:700; font-size:13px; }}
main {{ max-width:1540px; margin:0 auto; padding:clamp(28px,6vw,84px); }}
.toc {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:8px; margin-bottom:clamp(60px,9vw,120px); }}
.toc a {{ display:flex; justify-content:space-between; gap:12px; text-decoration:none; border:1px solid var(--line); border-radius:10px; padding:14px; background:var(--panel); }}
.toc a:hover {{ border-color:var(--brand); transform:translateY(-1px); }}
.toc span {{ font-weight:700; }} .toc small {{ color:var(--muted); }}
.role-section {{ scroll-margin-top:90px; margin:0 0 clamp(80px,12vw,150px); }}
.role-heading {{ display:grid; grid-template-columns:52px minmax(0,700px); gap:18px; margin-bottom:28px; }}
.role-number {{ margin:4px 0 0; font:700 13px/1 ui-monospace,SFMono-Regular,monospace; color:var(--brand); }}
.role-heading h2 {{ margin:0; font:700 clamp(31px,4vw,54px)/1 Georgia,serif; }}
.role-heading p:not(.role-number) {{ margin:12px 0 0; color:var(--muted); font-size:16px; line-height:1.55; }}
.feature-grid {{ display:grid; grid-template-columns:repeat(12,1fr); gap:24px; }}
.feature-card {{ grid-column:span 6; min-width:0; background:var(--panel); border:1px solid var(--line); border-radius:15px; overflow:hidden; box-shadow:var(--shadow); }}
.feature-card:nth-child(3n+1) {{ grid-column:span 7; }}
.feature-card:nth-child(3n+2) {{ grid-column:span 5; }}
.shot-link {{ display:block; aspect-ratio:14/9; background:var(--row); overflow:hidden; }}
.shot-link img {{ display:block; width:100%; height:100%; object-fit:cover; object-position:top center; transition:transform .24s ease; }}
.feature-card:hover img {{ transform:scale(1.012); }}
.feature-copy {{ padding:20px 22px 24px; }}
.feature-copy .eyebrow {{ margin:0 0 8px; }}
.feature-copy h3 {{ margin:0 0 8px; font:700 24px/1.15 Georgia,serif; }}
.feature-copy p:last-child {{ margin:0; color:var(--muted); line-height:1.55; }}
.hidden {{ display:none !important; }}
.no-matches {{ display:none; margin:60px auto; max-width:520px; text-align:center; padding:34px; background:var(--panel); border:1px solid var(--line); border-radius:14px; }}
.no-matches.visible {{ display:block; }}
footer {{ border-top:1px solid var(--line); padding:26px clamp(28px,6vw,84px) 50px; color:var(--muted); font-size:12px; }}
@media (max-width:800px) {{
  .hero {{ min-height:56vh; }} .search-wrap {{ align-items:stretch; }} .app-link {{ display:none; }}
  .feature-card,.feature-card:nth-child(n) {{ grid-column:1/-1; }}
  .role-heading {{ grid-template-columns:36px minmax(0,1fr); }}
}}
@media (prefers-reduced-motion:reduce) {{ * {{ scroll-behavior:auto !important; transition:none !important; }} }}
</style>
</head>
<body>
<header class="hero">
  <div class="hero-inner">
    <p class="kicker">Lorewell · visual product guide</p>
    <h1>Your files. An active private library.</h1>
    <p class="lede">The modern take is not “Calibre in a browser.” Lorewell helps
    you read, understand, connect, and remember what is inside—without taking
    ownership away from you.</p>
    <div class="hero-meta"><span>5 usage contexts</span><span>{total} feature screens</span><span>Standalone + NakliOS</span><span>Local-first AI</span></div>
  </div>
</header>
<div class="search-wrap">
  <label><span hidden>Search the guide</span><input id="guide-search" type="search" placeholder="Search roles, features, and captions…" autocomplete="off"><kbd>/</kbd></label>
  <a class="app-link" href="../index.html">Open Lorewell →</a>
</div>
<main>
  <nav class="toc" aria-label="Guide contents">{''.join(toc)}</nav>
  <div id="no-matches" class="no-matches"><h2>No matching screens</h2><p>Try “AI”, “notes”, “storage”, “Native”, or a reader context.</p></div>
  {''.join(sections_markup)}
</main>
<footer>Generated from <code>guide/capture.py</code> and <code>guide/build_index.py</code>. Screens show the production Lorewell surface with a fictional local library.</footer>
<script>
(() => {{
  const input = document.getElementById('guide-search');
  const cards = [...document.querySelectorAll('.feature-card')];
  const sections = [...document.querySelectorAll('.role-section')];
  const noMatches = document.getElementById('no-matches');
  function filter() {{
    const query = input.value.trim().toLowerCase();
    let visible = 0;
    for (const card of cards) {{
      const match = !query || card.dataset.search.includes(query);
      card.classList.toggle('hidden', !match);
      if (match) visible += 1;
    }}
    for (const section of sections) {{
      section.classList.toggle('hidden', !section.querySelector('.feature-card:not(.hidden)'));
    }}
    noMatches.classList.toggle('visible', visible === 0);
  }}
  input.addEventListener('input', filter);
  document.addEventListener('keydown', event => {{
    if (event.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {{
      event.preventDefault(); input.focus(); input.select();
    }}
    if (event.key === 'Escape') {{ input.value = ''; filter(); input.blur(); }}
  }});
}})();
</script>
</body>
</html>
"""


def main() -> None:
    output = GUIDE / "index.html"
    rendered = "\n".join(line.rstrip() for line in build().splitlines()) + "\n"
    output.write_text(rendered)
    print(f"Built {output}")


if __name__ == "__main__":
    main()
