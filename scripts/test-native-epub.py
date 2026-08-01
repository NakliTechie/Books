#!/usr/bin/env python3
# H8 — validate native EPUB extraction against a real binary EPUB whose ZIP
# entry order and filenames both differ from the OPF spine order, and which
# carries a linear="no" section. This exercises the spine-ordering fix on a
# genuine ebook rather than the short Markdown fixture the audit flagged.
# (MOBI/AZW3 parity is not covered here: native MOBI/AZW3 extraction shells out
# to Calibre's ebook-convert, which is not available in this environment.)
import importlib.util
from pathlib import Path
import sys
import tempfile
import zipfile

sys.dont_write_bytecode = True
module_path = Path(__file__).with_name("books-index.py")
spec = importlib.util.spec_from_file_location("books_index", module_path)
books_index = importlib.util.module_from_spec(spec)
spec.loader.exec_module(books_index)

CONTAINER = """<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"""

OPF = """<?xml version="1.0"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:fixture</dc:identifier>
    <dc:title>Spine Order Fixture</dc:title>
  </metadata>
  <manifest>
    <item id="cz" href="chap-z.xhtml" media-type="application/xhtml+xml"/>
    <item id="ca" href="chap-a.xhtml" media-type="application/xhtml+xml"/>
    <item id="cm" href="chap-m.xhtml" media-type="application/xhtml+xml"/>
    <item id="cnl" href="chap-nonlinear.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="cz"/>
    <itemref idref="ca"/>
    <itemref idref="cm"/>
    <itemref idref="cnl" linear="no"/>
  </spine>
</package>"""


def chapter(title):
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<html xmlns="http://www.w3.org/1999/xhtml"><body>'
        f"<p>{title} chapter with enough words to extract cleanly.</p>"
        "</body></html>"
    )


with tempfile.TemporaryDirectory(prefix="books-epub-") as directory:
    epub_path = Path(directory) / "fixture.epub"
    with zipfile.ZipFile(epub_path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED
        )
        archive.writestr("META-INF/container.xml", CONTAINER)
        archive.writestr("OEBPS/content.opf", OPF)
        # Add chapters in an order that matches neither the spine nor an
        # alphabetical sort, so only real spine parsing yields the right order.
        archive.writestr("OEBPS/chap-m.xhtml", chapter("Mu"))
        archive.writestr("OEBPS/chap-z.xhtml", chapter("Zeta"))
        archive.writestr("OEBPS/chap-nonlinear.xhtml", chapter("Nonlinear"))
        archive.writestr("OEBPS/chap-a.xhtml", chapter("Alpha"))

    sections = books_index.extract_sections(epub_path, "epub")
    labels = [section["label"] for section in sections]

    # Sections follow the OPF spine (Zeta, Alpha, Mu), not ZIP or alphabetical order.
    assert labels == ["chap-z", "chap-a", "chap-m"], labels
    assert labels != sorted(labels), "spine order must differ from the fallback sort"
    # The linear="no" section is excluded from the reading sequence.
    assert all("Nonlinear" not in section["text"] for section in sections)
    assert "Zeta" in sections[0]["text"]

print("Books native EPUB spine-order contract: PASS")
