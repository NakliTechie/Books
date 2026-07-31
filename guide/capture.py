#!/usr/bin/env python3
"""Capture the generated Books guide from the real production browser surface."""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from playwright.sync_api import Page, Playwright, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / "guide" / "screenshots"
SEED_DIR = ROOT / "demo" / "seed"
DEFAULT_BASE = "http://127.0.0.1:4177/dist/"
VIEWPORT = {"width": 1400, "height": 900}


@dataclass(frozen=True)
class Capture:
    number: int
    slug: str
    route: str
    action: str
    wait_ms: int = 500


@dataclass(frozen=True)
class RolePlan:
    slug: str
    title: str
    captures: tuple[Capture, ...]


ROLE_PLANS = (
    RolePlan(
        "visitor",
        "Anonymous visitor",
        (
            Capture(1, "private-start", "standalone:empty", "empty"),
        ),
    ),
    RolePlan(
        "first-run",
        "Brand-new reader",
        (
            Capture(1, "add-your-library", "standalone:empty", "empty"),
            Capture(2, "choose-library-location", "standalone:storage", "storage"),
        ),
    ),
    RolePlan(
        "library-owner",
        "Library owner",
        (
            Capture(1, "library-home", "standalone:library", "seed"),
            Capture(2, "views-and-filtering", "standalone:views", "views"),
            Capture(3, "book-details", "standalone:details", "details"),
            Capture(4, "safety-and-portability", "standalone:tools", "tools", 900),
            Capture(5, "ask-the-library", "standalone:ask", "ask"),
            Capture(6, "ai-providers", "standalone:providers", "providers"),
        ),
    ),
    RolePlan(
        "active-reader",
        "Active reader",
        (
            Capture(1, "faithful-reader", "reader:faithful", "reader"),
            Capture(2, "native-reader", "reader:native", "native", 900),
            Capture(3, "find-in-book", "reader:search", "reader-search", 700),
            Capture(4, "notes-and-bookmarks", "reader:notes", "reader-notes"),
            Capture(5, "reading-appearance", "reader:appearance", "appearance"),
            Capture(6, "ai-reading-companion", "reader:ai", "reader-ai", 1200),
        ),
    ),
    RolePlan(
        "naklios-reader",
        "NakliOS reader",
        (
            Capture(1, "hosted-library", "hosted:library", "hosted", 900),
            Capture(2, "isolated-storage", "hosted:storage", "hosted-storage"),
        ),
    ),
)


def selected_plans(scope: str | None) -> tuple[RolePlan, ...]:
    if not scope or scope == "update":
        return ROLE_PLANS
    needle = scope.strip().lower()
    roles = tuple(plan for plan in ROLE_PLANS if plan.slug == needle)
    if roles:
        return roles
    narrowed = []
    for plan in ROLE_PLANS:
        captures = tuple(
            capture
            for capture in plan.captures
            if capture.slug == needle or needle in capture.slug
        )
        if captures:
            narrowed.append(RolePlan(plan.slug, plan.title, captures))
    if narrowed:
        return tuple(narrowed)
    known = ", ".join(
        [plan.slug for plan in ROLE_PLANS]
        + [capture.slug for plan in ROLE_PLANS for capture in plan.captures]
    )
    raise SystemExit(f"Unknown guide scope {scope!r}. Known roles/features: {known}")


def wait_for_ready(page: Page, settle_ms: int = 500) -> None:
    page.wait_for_load_state("load")
    page.evaluate("() => document.fonts.ready")
    page.wait_for_timeout(settle_ms)


def close_dialogs(page: Page) -> None:
    page.evaluate(
        """() => {
          for (const dialog of document.querySelectorAll('dialog[open]')) {
            try { dialog.close(); } catch (_) {}
          }
          document.querySelector('#reader-ai-close')?.click();
          const searchClose = document.querySelector('#reader-search-close');
          if (searchClose && !document.querySelector('#reader-searchbar')?.hidden) {
            searchClose.click();
          }
          const options = document.querySelector('#library-options');
          if (options) options.open = false;
        }"""
    )


def browser_store(page: Page, records: list[dict], *, clear: bool) -> None:
    page.evaluate(
        """async ({ records, clear }) => {
          const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('naklios-books-library-v1', 2);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = () => {
              const db = request.result;
              if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
              if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
            };
          });
          await new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readwrite');
            const store = tx.objectStore('files');
            if (clear) store.clear();
            for (const record of records) {
              const value = record.kind === 'binary'
                ? { kind:'binary', data:new Uint8Array(record.data).buffer }
                : { kind:'text', data:record.data };
              store.put(value, record.path);
            }
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
          });
          db.close();
        }""",
        {"records": records, "clear": clear},
    )


def sidecar(filename: str, title: str, author: str, fraction: float, note: str) -> dict:
    book_id = filename.rsplit(".", 1)[0]
    book_id = "".join(
        character if character.isalnum() or character == "-" else "_"
        for character in book_id
    ).strip("_") or "book"
    return {
        "bookId": book_id,
        "sourceFilename": filename,
        "title": title,
        "author": author,
        "format": filename.rsplit(".", 1)[-1].lower(),
        "engine": "text",
        "position": {"engine": "text", "fraction": fraction},
        "nativePosition": None,
        "preferredMode": "faithful",
        "lastOpened": "2026-07-30T12:00:00.000Z",
        "note": note,
        "bookmarks": [
            {
                "id": f"bookmark-{book_id.lower()}",
                "label": "Return to this idea",
                "position": {"engine": "text", "fraction": fraction},
                "createdAt": "2026-07-30T12:05:00.000Z",
            }
        ],
        "readerPrefs": None,
        "coverPath": None,
        "coverMime": None,
        "coverUnavailable": True,
    }


def seed_records() -> list[dict]:
    metadata = {
        "Seeing Systems.md": (
            "Seeing Systems",
            "Mira Sen",
            0.28,
            "Compare the idea of delayed feedback with the library as external memory.",
        ),
        "The Library Within.txt": (
            "The Library Within",
            "Asha Raman",
            0.54,
            "The distinction between sources and rebuildable indexes is central.",
        ),
        "Field Notes on Attention.html": (
            "Field Notes on Attention",
            "Noor Merchant",
            0.16,
            "Attention as a promise about interruption.",
        ),
        "Small Garden, Long Time.md": (
            "Small Garden, Long Time",
            "Ira Mehta",
            0.72,
            "Time made visible is a useful description of patient craft.",
        ),
    }
    records: list[dict] = []
    for filename, (title, author, fraction, note) in metadata.items():
        payload = (SEED_DIR / filename).read_bytes()
        records.append(
            {"path": f"library/{filename}", "kind": "binary", "data": list(payload)}
        )
        record = sidecar(filename, title, author, fraction, note)
        records.append(
            {
                "path": f"notes/{record['bookId']}.json",
                "kind": "text",
                "data": json.dumps(record, indent=2),
            }
        )
    return records


def reset_empty(page: Page, base: str) -> None:
    if not page.url.startswith(base):
        page.goto(base, wait_until="load")
    close_dialogs(page)
    browser_store(page, [], clear=True)
    page.evaluate("() => localStorage.clear()")
    page.reload(wait_until="load")
    page.locator("#main .card").wait_for(state="visible")
    wait_for_ready(page)


def seed_library(page: Page, base: str) -> None:
    close_dialogs(page)
    if not page.url.startswith(base):
        page.goto(base, wait_until="load")
    browser_store(page, seed_records(), clear=True)
    page.evaluate(
        """() => {
          localStorage.setItem('books.semanticProcessingPaused.v1', 'false');
          localStorage.setItem('books.librarySort.v1', 'recent');
        }"""
    )
    page.reload(wait_until="load")
    page.locator("#main .library .row").first.wait_for(state="visible", timeout=15000)
    page.wait_for_function(
        "() => document.querySelectorAll('#main .library .row').length >= 4",
        timeout=15000,
    )
    wait_for_ready(page, 3500)


def show_storage(page: Page, base: str) -> None:
    if page.locator("#main .card").count() == 0:
        reset_empty(page, base)
    close_dialogs(page)
    page.locator("#storage-btn").click()
    page.locator("#storage-dialog[open]").wait_for(state="visible")


def open_library_options(page: Page) -> None:
    options = page.locator("#library-options")
    if not options.evaluate("element => element.open"):
        options.locator("summary").click()


def show_views(page: Page, base: str) -> None:
    close_dialogs(page)
    if page.locator("#main .library .row").count() == 0:
        seed_library(page, base)
    open_library_options(page)
    page.locator("#library-view-select").select_option("state:continue")
    page.locator("#library-filter").fill("library")
    page.wait_for_timeout(350)


def show_details(page: Page, base: str) -> None:
    close_dialogs(page)
    if page.locator("#main .library .row").count() == 0:
        seed_library(page, base)
    page.locator("#library-filter").fill("")
    open_library_options(page)
    page.locator("#library-view-select").select_option("all")
    page.locator("#library-options summary").click()
    row = page.locator('[data-filename="Seeing Systems.md"]')
    row.locator('[data-action="details"]').click()
    page.locator("#work-details-dialog[open]").wait_for(state="visible")
    page.locator("#work-tags-input").fill("systems, thinking, feedback")
    page.locator("#work-shelves-input").fill("Ideas to revisit")
    page.locator("#work-rating-input").select_option("5")


def show_tools(page: Page, base: str) -> None:
    close_dialogs(page)
    open_library_options(page)
    page.locator("#library-tools-btn").click()
    page.locator("#library-tools-dialog[open]").wait_for(state="visible")
    page.wait_for_timeout(500)


def show_ask(page: Page, base: str) -> None:
    close_dialogs(page)
    open_library_options(page)
    page.locator("#library-ask-btn").click()
    page.locator("#library-ask-dialog[open]").wait_for(state="visible")
    page.locator("#library-ask-question").fill(
        "Where do these books connect attention, feedback, and memory?"
    )


def show_providers(page: Page, base: str) -> None:
    if not page.locator("#library-ask-dialog[open]").count():
        show_ask(page, base)
    page.locator("#library-ask-settings").click()
    page.locator("#ai-provider-dialog[open]").wait_for(state="visible")
    page.locator('[data-ai-provider-preset="ollama"]').click()


def open_reader(page: Page, base: str) -> None:
    close_dialogs(page)
    if page.locator("#main .library .row").count() == 0:
        seed_library(page, base)
    page.locator("#library-filter").fill("")
    open_library_options(page)
    page.locator("#library-view-select").select_option("all")
    page.locator("#library-options summary").click()
    page.locator('[data-filename="Seeing Systems.md"] .row-text').click()
    page.locator("#reader.is-open").wait_for(state="visible", timeout=15000)
    page.locator("#reader-content").wait_for(state="visible")
    wait_for_ready(page, 800)


def show_native(page: Page, base: str) -> None:
    if not page.locator("#reader.is-open").count():
        open_reader(page, base)
    if page.locator("#reader-mode-btn").get_attribute("aria-pressed") != "true":
        page.locator("#reader-mode-btn").click()
    page.wait_for_timeout(700)


def show_reader_search(page: Page, base: str) -> None:
    close_dialogs(page)
    if not page.locator("#reader.is-open").count():
        open_reader(page, base)
    if page.locator("#reader-mode-btn").get_attribute("aria-pressed") == "true":
        page.locator("#reader-mode-btn").click()
        page.wait_for_timeout(500)
    page.locator("#reader-search-btn").click()
    page.locator("#reader-search-input").fill("feedback")
    page.wait_for_timeout(500)


def show_reader_notes(page: Page, base: str) -> None:
    close_dialogs(page)
    if not page.locator("#reader.is-open").count():
        open_reader(page, base)
    page.locator("#sidebar-toggle").click()
    page.locator("#sidebar.is-open").wait_for(state="visible")


def show_appearance(page: Page, base: str) -> None:
    close_dialogs(page)
    if not page.locator("#reader.is-open").count():
        open_reader(page, base)
    page.locator("#reader-prefs-btn").click()
    page.locator("#reader-prefs-dialog[open]").wait_for(state="visible")
    page.locator("#reader-profile").select_option("sepia")


def show_reader_ai(page: Page, base: str) -> None:
    close_dialogs(page)
    if not page.locator("#reader.is-open").count():
        open_reader(page, base)
    page.locator("#reader-ai-btn").click()
    page.locator("#reader-ai-sidecar.is-open").wait_for(state="visible")
    page.wait_for_timeout(800)


def hosted_page(page: Page, base: str) -> Page:
    root = base.rsplit("/dist/", 1)[0]
    hosted_url = root + "/test/host-harness.html?autorun=1"
    if not page.url.startswith(hosted_url):
        page.goto(hosted_url, wait_until="load")
    frame = page.frame_locator("#books")
    frame.locator("#main .library .row").first.wait_for(state="visible", timeout=15000)
    page.locator("#harness-status[data-state='pass']").wait_for(
        state="visible", timeout=30000
    )
    wait_for_ready(page, 700)
    return page


def show_hosted_storage(page: Page, base: str) -> None:
    hosted_page(page, base)
    frame = page.frame_locator("#books")
    frame.locator("#storage-btn").click()
    frame.locator("#storage-dialog[open]").wait_for(state="visible")


ACTIONS: dict[str, Callable[[Page, str], None]] = {
    "empty": reset_empty,
    "storage": show_storage,
    "seed": seed_library,
    "views": show_views,
    "details": show_details,
    "tools": show_tools,
    "ask": show_ask,
    "providers": show_providers,
    "reader": open_reader,
    "native": show_native,
    "reader-search": show_reader_search,
    "reader-notes": show_reader_notes,
    "appearance": show_appearance,
    "reader-ai": show_reader_ai,
    "hosted": hosted_page,
    "hosted-storage": show_hosted_storage,
}


def capture_guide(playwright: Playwright, base: str, plans: tuple[RolePlan, ...], headless: bool) -> int:
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    browser = playwright.chromium.launch(
        channel="chrome",
        headless=headless,
        args=["--disable-features=MediaRouter"],
    )
    context = browser.new_context(
        viewport=VIEWPORT,
        device_scale_factor=2,
        color_scheme="light",
        reduced_motion="reduce",
    )
    page = context.new_page()
    console_rows: list[dict] = []
    page.on(
        "console",
        lambda message: console_rows.append(
            {"type": message.type, "text": message.text, "url": page.url}
        )
        if message.type in {"error", "warning"}
        else None,
    )
    results: list[dict] = []
    page.goto(base, wait_until="load")
    wait_for_ready(page)

    for role in plans:
        role_dir = SCREENSHOTS / role.slug
        role_dir.mkdir(parents=True, exist_ok=True)
        for capture in role.captures:
            start_console = len(console_rows)
            output = role_dir / f"{capture.number:02d}-{capture.slug}.png"
            state = "ok"
            detail = ""
            try:
                ACTIONS[capture.action](page, base)
                wait_for_ready(page, capture.wait_ms)
                main_length = page.evaluate(
                    """() => {
                      const reader = document.querySelector('#reader.is-open #reader-content');
                      const hosted = document.querySelector('#books')?.contentDocument
                        ?.querySelector('#main');
                      const main = reader || hosted || document.querySelector('#main');
                      return main?.innerHTML?.length || 0;
                    }"""
                )
                if main_length <= 50:
                    raise RuntimeError(f"blank-capture guard: rendered content length was {main_length}")
                page.screenshot(path=str(output), full_page=False, animations="disabled")
                if output.stat().st_size < 8_000:
                    raise RuntimeError(
                        f"blank-capture guard: screenshot was only {output.stat().st_size} bytes"
                    )
            except Exception as error:  # keep coverage evidence even when one screen fails
                state = "fail"
                detail = str(error).replace("\n", " ")[:500]
            route_console = console_rows[start_console:]
            results.append(
                {
                    "role": role.slug,
                    "number": capture.number,
                    "slug": capture.slug,
                    "route": capture.route,
                    "state": state,
                    "detail": detail,
                    "console": route_console,
                    "file": str(output.relative_to(ROOT / "guide")),
                }
            )

    context.close()
    browser.close()

    ok_count = sum(row["state"] == "ok" for row in results)
    errors = sum(
        1
        for row in results
        for message in row["console"]
        if message["type"] == "error"
    )
    warnings = sum(
        1
        for row in results
        for message in row["console"]
        if message["type"] == "warning"
    )
    log = [
        "# Books guide capture log",
        "",
        f"{ok_count}/{len(results)} routes rendered ok · "
        f"{errors} console errors · {warnings} console warnings",
        "",
        "| Role | Feature | Route | Result | Console |",
        "| --- | --- | --- | --- | --- |",
    ]
    for row in results:
        messages = [
            f"{message['type']}: {message['text']}"
            for message in row["console"]
        ]
        console = "<br>".join(messages).replace("|", "\\|") or "—"
        result = row["state"]
        if row["detail"]:
            result += f": {row['detail']}"
        log.append(
            f"| {row['role']} | {row['slug']} | `{row['route']}` | "
            f"{result.replace('|', '\\|')} | {console} |"
        )
    (ROOT / "guide" / "CAPTURE-LOG.md").write_text("\n".join(log) + "\n")
    print(
        f"Captured {ok_count}/{len(results)} guide routes "
        f"({errors} console errors, {warnings} warnings)."
    )
    return 0 if ok_count == len(results) and errors == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("scope", nargs="?", help="role or feature slug to recapture")
    parser.add_argument(
        "--base",
        default=os.environ.get("BOOKS_GUIDE_BASE", DEFAULT_BASE),
        help="served production-build URL",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="diagnostic only; normal guide captures use a visible browser",
    )
    args = parser.parse_args()
    plans = selected_plans(args.scope)
    with sync_playwright() as playwright:
        return capture_guide(playwright, args.base, plans, args.headless)


if __name__ == "__main__":
    sys.exit(main())
