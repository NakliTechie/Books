#!/usr/bin/env python3
"""Generate a self-authored, legally reusable OCR evaluation corpus."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import random
import textwrap

from PIL import Image, ImageDraw, ImageFont


WIDTH = 1200
HEIGHT = 1600
BACKGROUND = (248, 244, 230)
INK = (36, 32, 27)
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
DEVANAGARI_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Devanagari Sangam MN.ttc",
    "/System/Library/Fonts/Supplemental/ITFDevanagari.ttc",
    *FONT_CANDIDATES,
]
ARABIC_CANDIDATES = [
    "/System/Library/Fonts/SFArabic.ttf",
    "/System/Library/Fonts/GeezaPro.ttc",
    *FONT_CANDIDATES,
]


def font(size: int, candidates=FONT_CANDIDATES):
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default(size=size)


TITLE = font(54)
BODY = font(31)
SMALL = font(24)
DEVANAGARI = font(36, DEVANAGARI_CANDIDATES)
ARABIC = font(36, ARABIC_CANDIDATES)


def page():
    return Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)


def wrapped(draw, position, value, width=58, fill=INK, spacing=13, used_font=BODY):
    text = "\n".join(textwrap.wrap(value, width=width))
    draw.multiline_text(
        position,
        text,
        fill=fill,
        font=used_font,
        spacing=spacing,
    )
    return text


def save_fixture(output: Path, fixture_id: str, image: Image.Image, entry: dict):
    filename = fixture_id + ".png"
    image.save(output / filename, format="PNG", optimize=True)
    return {
        "id": fixture_id,
        "filename": filename,
        "width": image.width,
        "height": image.height,
        **entry,
    }


def clean_page():
    image = page()
    draw = ImageDraw.Draw(image)
    draw.text((110, 100), "Feedback and Evidence", font=TITLE, fill=INK)
    value = (
        "A durable library keeps the original source, portable annotations, "
        "and the evidence behind every generated idea. Reading remains "
        "available while background processing is paused or incomplete."
    )
    wrapped(draw, (110, 240), value)
    draw.text((110, 570), "Chapter 1 · A clean printed page", font=SMALL, fill=INK)
    return image, {
        "features":["clean", "english", "heading", "paragraph"],
        "groundTruth":value,
    }


def low_contrast_page():
    image = Image.new("RGB", (WIDTH, HEIGHT), (225, 222, 208))
    draw = ImageDraw.Draw(image)
    value = (
        "Low contrast and uneven paper should lower confidence without "
        "silently changing the reading order."
    )
    draw.text((100, 120), "A Faded Scan", font=TITLE, fill=(113, 109, 99))
    wrapped(
        draw,
        (100, 270),
        value,
        fill=(128, 123, 111),
    )
    rng = random.Random(20260730)
    for _ in range(3500):
        x = rng.randrange(WIDTH)
        y = rng.randrange(HEIGHT)
        shade = rng.randrange(170, 235)
        draw.point((x, y), fill=(shade, shade, max(0, shade - 8)))
    return image, {
        "features":["low-contrast", "noise", "english"],
        "groundTruth":value,
    }


def skewed_page():
    base, entry = clean_page()
    rotated = base.rotate(
        6.5,
        resample=Image.Resampling.BICUBIC,
        expand=False,
        fillcolor=(230, 226, 213),
    )
    return rotated, {
        **entry,
        "features":["skewed", "english", "heading", "paragraph"],
        "rotationDegrees":6.5,
    }


def structured_page():
    image = page()
    draw = ImageDraw.Draw(image)
    draw.text((80, 70), "Two Columns, Table, and Formula", font=TITLE, fill=INK)
    left = (
        "The left column introduces a mechanism. Evidence remains linked to "
        "its source passage and page coordinates."
    )
    right = (
        "The right column tests reading order. The table below must remain a "
        "table rather than becoming arbitrary lines."
    )
    wrapped(draw, (80, 210), left, width=32)
    wrapped(draw, (640, 210), right, width=32)
    top = 650
    left_x = 170
    cell_w = 280
    cell_h = 90
    for row in range(4):
        draw.line(
            (left_x, top + row * cell_h, left_x + cell_w * 3, top + row * cell_h),
            fill=INK,
            width=3,
        )
    for column in range(4):
        draw.line(
            (left_x + column * cell_w, top, left_x + column * cell_w, top + cell_h * 3),
            fill=INK,
            width=3,
        )
    values = [
        ["Stage", "State", "Retry"],
        ["Passages", "Ready", "No"],
        ["OCR", "Partial", "Yes"],
    ]
    for row, values_row in enumerate(values):
        for column, value in enumerate(values_row):
            draw.text(
                (left_x + column * cell_w + 18, top + row * cell_h + 24),
                value,
                font=SMALL,
                fill=INK,
            )
    draw.text((350, 1090), "Energy relation: E = mc²", font=BODY, fill=INK)
    return image, {
        "features":[
            "two-column",
            "reading-order",
            "table",
            "formula",
            "english",
        ],
        "groundTruth":left + "\n" + right + "\n" + " ".join(sum(values, []))
        + "\nEnergy relation: E = mc²",
    }


def mixed_script_page():
    image = page()
    draw = ImageDraw.Draw(image)
    draw.text((90, 80), "Mixed-script recognition", font=TITLE, fill=INK)
    english = "Books keeps ideas connected to evidence."
    hindi = "पुस्तकें विचारों को प्रमाण से जोड़ती हैं।"
    arabic = "تربط الكتب الأفكار بالأدلة."
    draw.text((100, 270), english, font=BODY, fill=INK)
    draw.text((100, 420), hindi, font=DEVANAGARI, fill=INK)
    try:
        draw.text((100, 580), arabic, font=ARABIC, fill=INK, direction="rtl")
    except (KeyError, ValueError):
        draw.text((100, 580), arabic, font=ARABIC, fill=INK)
    return image, {
        "features":["mixed-script", "english", "devanagari", "arabic"],
        "groundTruth":"\n".join([english, hindi, arabic]),
        "renderingNote":(
            "Verify shaping on the generation machine before using character "
            "error rate as a gate."
        ),
    }


def vertical_page():
    image = page()
    draw = ImageDraw.Draw(image)
    draw.text((100, 90), "Rotated and vertical text", font=TITLE, fill=INK)
    horizontal = "Orientation must be explicit in page and region provenance."
    wrapped(draw, (100, 250), horizontal)
    strip = Image.new("RGBA", (800, 100), (0, 0, 0, 0))
    strip_draw = ImageDraw.Draw(strip)
    strip_draw.text((10, 20), "VERTICAL READING ORDER", font=BODY, fill=INK + (255,))
    strip = strip.rotate(90, expand=True)
    image.paste(strip, (790, 520), strip)
    return image, {
        "features":["vertical", "rotated-region", "english"],
        "groundTruth":horizontal + "\nVERTICAL READING ORDER",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", help="Directory to create")
    args = parser.parse_args()
    output = Path(args.output).expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    fixtures = []
    for fixture_id, factory in [
        ("clean-english", clean_page),
        ("low-contrast", low_contrast_page),
        ("skewed", skewed_page),
        ("structured-layout", structured_page),
        ("mixed-script", mixed_script_page),
        ("vertical-region", vertical_page),
    ]:
        image, entry = factory()
        fixtures.append(save_fixture(output, fixture_id, image, entry))
    manifest = {
        "schemaVersion":1,
        "recordType":"books.ocr-corpus",
        "license":"CC0-1.0",
        "authorship":"Self-authored synthetic fixtures generated by Books.",
        "generatedBy":"scripts/generate-ocr-corpus.py",
        "companionManifest":"test/ocr-public-corpus.json",
        "fixtures":fixtures,
        "missingRealWorldClasses":[
            "positive camera-captured page with readable public-domain ground truth",
            "real multilingual pages with verified full transcriptions",
            "real vertical-script page with verified full transcription",
            "full line-level ground truth for every public fixture",
        ],
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(fixtures)} OCR fixtures in {output}")


if __name__ == "__main__":
    main()
