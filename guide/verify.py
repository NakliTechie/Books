#!/usr/bin/env python3
"""Verify the generated Lorewell guide in a real browser."""

from __future__ import annotations

import argparse
import sys

from playwright.sync_api import sync_playwright


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base",
        default="http://127.0.0.1:4177/guide/",
        help="served guide URL",
    )
    args = parser.parse_args()
    console_errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            channel="chrome",
            headless=True,
            args=["--disable-features=MediaRouter"],
        )
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.on(
            "console",
            lambda message: console_errors.append(message.text)
            if message.type == "error"
            else None,
        )
        page.goto(args.base, wait_until="load")
        page.evaluate("() => document.fonts.ready")
        page.evaluate(
            "() => [...document.images].forEach(image => { image.loading = 'eager'; })"
        )
        page.wait_for_function(
            "() => [...document.images].every(image => image.complete)",
            timeout=30_000,
        )

        cards = page.locator(".feature-card")
        sections = page.locator(".role-section")
        if cards.count() != 19 or sections.count() != 5:
            raise RuntimeError(
                f"Expected 19 feature cards across 5 roles; found "
                f"{cards.count()} cards across {sections.count()} roles."
            )
        broken_images = page.evaluate(
            """() => [...document.images]
              .filter(image => image.naturalWidth === 0)
              .map(image => image.getAttribute('src'))"""
        )
        if broken_images:
            raise RuntimeError(f"Guide images failed to load: {broken_images}")

        search = page.locator("#guide-search")
        search.fill("Echo")
        matches = page.evaluate(
            """() => [...document.querySelectorAll('.feature-card:not(.hidden)')]
              .map(card => ({ id:card.id, search:card.dataset.search }))"""
        )
        if not matches or any("echo" not in row["search"] for row in matches):
            raise RuntimeError(f"Inline Echo search returned invalid cards: {matches}")
        search.press("Escape")
        if page.locator(".feature-card:not(.hidden)").count() != 19:
            raise RuntimeError("Escape did not restore every guide card.")

        active_reader_link = page.locator('.toc a[href="#active-reader"]')
        if active_reader_link.count() != 1:
            raise RuntimeError("The Active reader TOC anchor is missing or ambiguous.")
        active_reader_link.click()
        page.wait_for_function("() => location.hash === '#active-reader'")
        if console_errors:
            raise RuntimeError(f"Guide emitted console errors: {console_errors}")
        browser.close()

    print(
        "Guide verification passed: 5 roles · 19 features · "
        f"{len(matches)} Echo search matches · images and TOC ready."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
