#!/usr/bin/env python3
"""Index a Books folder on disk using the portable `.books/` format.

The browser and this native executor share source fingerprints, passages,
ideas, embeddings, jobs, and library-level idea links. Native embeddings use
sentence-transformers by default, or an OpenAI-compatible/Ollama endpoint.

Examples:
  python3 scripts/books-index.py /path/to/library
  python3 scripts/books-index.py /path/to/library --no-embeddings
  python3 scripts/books-index.py /path/to/library \
    --endpoint http://127.0.0.1:11434 --embedding-model nomic-embed-text

Optional dependencies:
  pip install sentence-transformers pypdf
"""

from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path
import re
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from urllib import request
import uuid
import zipfile
import xml.etree.ElementTree as ET


SUPPORTED = {"epub", "pdf", "mobi", "azw3", "fb2", "txt", "md", "html", "htm"}
SKIP_DIRECTORIES = {".books", ".git", ".hg", ".svn", "node_modules"}
STOP_WORDS = {
    "about", "after", "again", "against", "also", "among", "because", "been",
    "before", "being", "between", "both", "could", "does", "doing", "down",
    "during", "each", "from", "further", "have", "having", "here", "into",
    "itself", "more", "most", "other", "over", "same", "should", "some",
    "such", "than", "that", "their", "theirs", "them", "then", "there",
    "these", "they", "this", "those", "through", "under", "until", "very",
    "what", "when", "where", "which", "while", "with", "would", "your",
}
SIDECAR = ".books"
PASSAGE_VERSION = "passages-v2"
LEXICAL_VERSION = "lexical-v1"
SEMANTIC_VERSION = "deterministic-semantics-v1"
IDEA_VERSION = "source-grounded-ideas-v1"
EMBEDDING_ENCODING = "books-float32-le-v1"
GRAPH_VERSION = "library-idea-links-v1"
PIPELINE_VERSION = "library-intelligence-v1"
RELATION_TYPES = {
    "same_as", "supports", "contradicts", "extends", "example_of",
    "applies_to", "shares_mechanism", "related_to",
}
MAX_PASSAGE_CHARS = 1400
MAX_CONCEPTS = 16
MAX_SCENES = 12
MAX_CONCEPT_EVIDENCE = 4
LIBRARY_LINK_MIN_SCORE = 0.68
LIBRARY_LINKS_PER_IDEA = 8
RELATION_CLASSIFICATION_MIN_CONFIDENCE = 0.65


class ProcessingCancelled(Exception):
    pass


class SourceChangedDuringScan(Exception):
    pass


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_timestamp(value: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def native_executor_id() -> str:
    return f"native:{socket.gethostname()}:{os.getpid()}"


def read_json(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def atomic_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + f".tmp-{os.getpid()}-{uuid.uuid4().hex[:8]}")
    with temp.open("w", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, separators=(",", ":"))
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)


def atomic_vector_shard(path: Path, vectors: list[list[float]], dimensions: int) -> None:
    if any(len(vector) != dimensions for vector in vectors):
        raise ValueError("Every embedding vector must use the declared dimensions")
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + f".tmp-{os.getpid()}-{uuid.uuid4().hex[:8]}")
    with temp.open("wb") as stream:
        stream.write(struct.pack("<4sII", b"BIE1", len(vectors), dimensions))
        for vector in vectors:
            stream.write(struct.pack(f"<{dimensions}f", *vector))
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)


def read_vector_shard(path: Path, expected_rows: int, dimensions: int) -> list[list[float]]:
    with path.open("rb") as stream:
        header = stream.read(12)
        if len(header) != 12:
            raise ValueError(f"Truncated idea-vector shard: {path}")
        magic, rows, stored_dimensions = struct.unpack("<4sII", header)
        if magic != b"BIE1" or rows != expected_rows or stored_dimensions != dimensions:
            raise ValueError(f"Idea-vector shard does not match its manifest: {path}")
        row_bytes = dimensions * 4
        vectors = []
        for _ in range(rows):
            value = stream.read(row_bytes)
            if len(value) != row_bytes:
                raise ValueError(f"Truncated idea-vector shard: {path}")
            vectors.append(list(struct.unpack(f"<{dimensions}f", value)))
        if stream.read(1):
            raise ValueError(f"Idea-vector shard has trailing bytes: {path}")
        return vectors


def file_fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return "sha256:" + digest.hexdigest()


def stable_file_snapshot(path: Path, attempts: int = 3):
    latest = None
    for attempt in range(max(1, attempts)):
        before = path.stat()
        fingerprint = file_fingerprint(path)
        after = path.stat()
        latest = after
        before_signature = (
            before.st_size,
            before.st_mtime_ns,
            getattr(before, "st_ino", None),
        )
        after_signature = (
            after.st_size,
            after.st_mtime_ns,
            getattr(after, "st_ino", None),
        )
        if before_signature == after_signature:
            return after, fingerprint
        if attempt + 1 < attempts:
            time.sleep(0.05 * (attempt + 1))
    raise SourceChangedDuringScan(
        f"Source changed while it was being fingerprinted: {path}"
    )


def text_hash(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def record_id(kind: str) -> str:
    return f"{kind}_{uuid.uuid4()}".lower()


def legacy_book_id(filename: str) -> str:
    stem = re.sub(r"\.[a-z0-9]{2,5}$", "", filename, flags=re.I)
    return re.sub(r"^_+|_+$", "", re.sub(r"[^a-zA-Z0-9-]+", "_", stem)) or "book"


def normalize_text(value: str) -> str:
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[\t\f\v ]+", " ", value)
    value = re.sub(r" *\n *", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def tokens(value: str) -> list[str]:
    return re.findall(r"[\w][\w'’-]*", normalize_text(value).lower(), flags=re.UNICODE)


def path_collision_key(relative: str) -> str:
    return unicodedata.normalize("NFC", relative).casefold()


def scan_sources(
    root: Path,
    previous: dict | None,
    scan_attempts: int = 3,
) -> tuple[dict, list[Path]]:
    previous_by_path = {
        row.get("relativePath"): row
        for row in (previous or {}).get("files", [])
        if row.get("relativePath")
    }
    previous_missing_by_path = {
        row.get("relativePath"): row
        for row in (previous or {}).get("missing", [])
        if row.get("relativePath")
    }
    generation = max(1, int((previous or {}).get("generation") or 0) + 1)
    rows = []
    paths = []
    for directory, names, filenames in os.walk(root, followlinks=False):
        names[:] = sorted(
            name for name in names
            if name not in SKIP_DIRECTORIES and not name.startswith(".")
        )
        directory_path = Path(directory)
        for name in sorted(filenames):
            if name.startswith("."):
                continue
            source = directory_path / name
            if source.is_symlink():
                continue
            extension = source.suffix.lower().lstrip(".")
            if extension not in SUPPORTED:
                continue
            relative = source.relative_to(root).as_posix()
            stat = source.stat()
            prior = previous_by_path.get(relative)
            unchanged = (
                prior
                and int(prior.get("byteLength") or 0) == stat.st_size
                and int(prior.get("lastModified") or 0) == int(stat.st_mtime * 1000)
            )
            fingerprint = prior.get("fingerprint") if unchanged else None
            fingerprint_status = (
                "complete"
                if unchanged and fingerprint
                else "pending"
            )
            scan_issue = None
            if not fingerprint:
                try:
                    stat, fingerprint = stable_file_snapshot(
                        source,
                        scan_attempts,
                    )
                    fingerprint_status = "complete"
                except SourceChangedDuringScan as error:
                    stat = source.stat()
                    fingerprint = prior.get("fingerprint") if prior else None
                    fingerprint_status = "unstable"
                    scan_issue = str(error)
            row = {
                "relativePath": relative,
                "kind": "file",
                "format": extension,
                "mediaType": None,
                "byteLength": stat.st_size,
                "lastModified": int(stat.st_mtime * 1000),
                "fingerprint": fingerprint,
                "fingerprintStatus": fingerprint_status,
                "lastSeenGeneration": generation,
            }
            if scan_issue:
                row["scanIssue"] = scan_issue
            rows.append(row)
            paths.append(source)

    seen = {row["relativePath"] for row in rows}
    missing = []
    for relative, prior in previous_by_path.items():
        if relative in seen:
            continue
        missing.append({
            "relativePath": relative,
            "fingerprint": prior.get("fingerprint"),
            "firstMissingGeneration": prior.get("firstMissingGeneration") or generation,
            "lastSeenGeneration": prior.get("lastSeenGeneration") or 0,
        })
    for relative, prior in previous_missing_by_path.items():
        if relative in seen or any(
            row["relativePath"] == relative for row in missing
        ):
            continue
        missing.append({
            "relativePath": relative,
            "fingerprint": prior.get("fingerprint"),
            "firstMissingGeneration": (
                prior.get("firstMissingGeneration") or generation
            ),
            "lastSeenGeneration": prior.get("lastSeenGeneration") or 0,
        })
    rows.sort(key=lambda row: row["relativePath"])
    missing.sort(key=lambda row: row["relativePath"])
    prior_signatures = {
        (
            row.get("relativePath"),
            row.get("byteLength"),
            row.get("lastModified"),
        )
        for row in previous_by_path.values()
    }
    current_signatures = {
        (row["relativePath"], row["byteLength"], row["lastModified"])
        for row in rows
    }
    added = sum(1 for row in rows if row["relativePath"] not in previous_by_path)
    changed = sum(
        1 for row in rows
        if row["relativePath"] in previous_by_path
        and (
            row["relativePath"],
            row["byteLength"],
            row["lastModified"],
        ) not in prior_signatures
    )
    collision_paths = {}
    for row in rows:
        collision_paths.setdefault(
            path_collision_key(row["relativePath"]),
            [],
        ).append(row["relativePath"])
    collisions = [
        {
            "collisionKey": key,
            "paths": sorted(set(values)),
        }
        for key, values in collision_paths.items()
        if len(set(values)) > 1
    ]
    collisions.sort(key=lambda collision: collision["collisionKey"])
    inventory = {
        "schemaVersion": 1,
        "recordType": "books.folder-inventory",
        "generation": generation,
        "scannedAt": timestamp(),
        "completed": True,
        "files": rows,
        "missing": missing,
        "collisions": collisions,
        "counts": {
            "total": len(rows),
            "added": added,
            "changed": changed,
            "unchanged": len(current_signatures & prior_signatures),
            "missing": len(missing),
            "collisions": len(collisions),
            "unstable": sum(
                row["fingerprintStatus"] == "unstable" for row in rows
            ),
        },
    }
    return inventory, paths


class VisibleTextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.ignored = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "template"}:
            self.ignored += 1
        elif tag in {"p", "div", "li", "br", "h1", "h2", "h3", "blockquote"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "template"}:
            self.ignored = max(0, self.ignored - 1)
        elif tag in {"p", "div", "li", "h1", "h2", "h3", "blockquote"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.ignored:
            self.parts.append(data)

    def text(self):
        return normalize_text(html.unescape(" ".join(self.parts)))


def html_text(value: str) -> str:
    parser = VisibleTextParser()
    parser.feed(value)
    return parser.text()


def markdown_sections(text: str) -> list[dict]:
    sections = []
    label = "Document"
    lines = []
    for line in text.splitlines():
        heading = re.match(r"^#{1,3}\s+(.+?)\s*#*\s*$", line)
        if heading:
            if normalize_text("\n".join(lines)):
                sections.append({"label": label, "text": "\n".join(lines)})
            label = heading.group(1).strip()
            lines = []
        else:
            lines.append(line)
    if normalize_text("\n".join(lines)):
        sections.append({"label": label, "text": "\n".join(lines)})
    return sections or [{"label": "Document", "text": text}]


def extract_sections(source: Path, extension: str) -> list[dict]:
    if extension in {"txt", "md"}:
        text = source.read_text(encoding="utf-8", errors="replace")
        return markdown_sections(text) if extension == "md" else [{"label": "Document", "text": text}]
    if extension in {"html", "htm"}:
        return [{
            "label": "Document",
            "text": html_text(source.read_text(encoding="utf-8", errors="replace")),
        }]
    if extension == "epub":
        sections = []
        with zipfile.ZipFile(source) as archive:
            names = sorted(
                name for name in archive.namelist()
                if re.search(r"\.(xhtml|html|htm)$", name, flags=re.I)
                and not name.lower().startswith("meta-inf/")
            )
            for name in names:
                value = archive.read(name).decode("utf-8", errors="replace")
                text = html_text(value)
                if text:
                    sections.append({"label": Path(name).stem, "text": text})
        return sections
    if extension == "fb2":
        root = ET.parse(source).getroot()
        sections = []
        for index, section in enumerate(root.iter()):
            if section.tag.rsplit("}", 1)[-1] != "section":
                continue
            text = normalize_text(" ".join(section.itertext()))
            if text:
                sections.append({"label": f"Section {index + 1}", "text": text})
        return sections
    if extension == "pdf":
        try:
            from pypdf import PdfReader
        except ImportError as error:
            raise RuntimeError("PDF extraction needs: pip install pypdf") from error
        reader = PdfReader(str(source))
        sections = [
            {"label": f"Page {index + 1}", "text": page.extract_text() or ""}
            for index, page in enumerate(reader.pages)
        ]
        if not any(normalize_text(row["text"]) for row in sections):
            raise RuntimeError("This PDF has no text layer; OCR is required")
        return sections
    if extension in {"mobi", "azw3"}:
        converter = shutil.which("ebook-convert")
        if not converter:
            raise RuntimeError(
                f".{extension} extraction needs Calibre's ebook-convert command"
            )
        with tempfile.TemporaryDirectory(prefix="books-index-") as temp:
            output = Path(temp) / "book.txt"
            subprocess.run(
                [converter, str(source), str(output)],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
            )
            return [{"label": "Document", "text": output.read_text(
                encoding="utf-8", errors="replace"
            )}]
    raise RuntimeError(f"No native parser for .{extension}")


def segment_sections(work_id: str, asset_id: str, extension: str, sections: list[dict]):
    passages = []
    for section_index, section in enumerate(sections):
        text = normalize_text(section.get("text") or "")
        if not text:
            continue
        paragraphs = [part.strip() for part in re.split(r"\n{2,}", text) if part.strip()]
        chunks = []
        current = ""
        for paragraph in paragraphs:
            if (
                current
                and len(current) + len(paragraph) + 2 > MAX_PASSAGE_CHARS
            ):
                chunks.append(current)
                current = ""
            if len(paragraph) > MAX_PASSAGE_CHARS:
                if current:
                    chunks.append(current)
                    current = ""
                chunks.extend(
                    paragraph[offset:offset + MAX_PASSAGE_CHARS]
                    for offset in range(0, len(paragraph), MAX_PASSAGE_CHARS)
                )
            else:
                current += ("\n\n" if current else "") + paragraph
        if current:
            chunks.append(current)
        cursor = 0
        for chunk in chunks:
            start = text.find(chunk, cursor)
            if start < 0:
                start = cursor
            end = start + len(chunk)
            cursor = end
            quote = chunk[:240]
            passage_id = f"passage_{asset_id}_{section_index}_{start}_{end}"
            passages.append({
                "passageId": passage_id,
                "workId": work_id,
                "assetId": asset_id,
                "extractorVersion": PASSAGE_VERSION,
                "order": len(passages),
                "text": chunk,
                "structure": {
                    "sectionIndex": section_index,
                    "label": section.get("label"),
                    "unsupportedStructures": [],
                },
                "anchor": {
                    "format": extension,
                    "normalizedRange": {"start": start, "end": end},
                    "quote": quote,
                    "quoteHash": text_hash(quote),
                    "engine": {
                        "kind": "native-disk-section",
                        "sectionIndex": section_index,
                        "fraction": start / max(1, len(text)),
                    },
                },
            })
    return passages


def lexical_index(work_id: str, title: str, authors: list, passages: list):
    postings = {}
    frequencies = {}

    def add(term, index, weight):
        values = postings.setdefault(term, [])
        if not values or values[-1] != index:
            values.append(index)
        frequencies[term] = frequencies.get(term, 0) + weight

    metadata = " ".join([title] + [
        author.get("name", "") if isinstance(author, dict) else str(author)
        for author in authors
    ])
    for term in tokens(metadata):
        add(term, -1, 3)
    for index, passage in enumerate(passages):
        for term in tokens(passage["text"]):
            add(term, index, 1)
    return {
        "schemaVersion": 2,
        "recordType": "books.lexical-index",
        "indexVersion": LEXICAL_VERSION,
        "workId": work_id,
        "passageIds": [passage["passageId"] for passage in passages],
        "postings": dict(sorted(postings.items())),
        "termFrequency": frequencies,
    }


def deterministic_semantics(work_id: str, passages: list, index: dict):
    candidates = []
    for term, frequency in index["termFrequency"].items():
        passage_indexes = [value for value in index["postings"].get(term, []) if value >= 0]
        if len(term) < 4 or term in STOP_WORDS or term.isnumeric() or not passage_indexes:
            continue
        score = frequency * (1 + math.log2(1 + len(passage_indexes)))
        candidates.append((score, term, frequency, passage_indexes))
    candidates.sort(key=lambda row: (-row[0], row[1]))
    concepts = []
    for score, term, _, passage_indexes in candidates[:MAX_CONCEPTS]:
        concept_id = f"concept_{work_id}_{re.sub(r'[^\\w-]+', '_', term)}"
        concepts.append({
            "conceptId": concept_id,
            "workId": work_id,
            "label": term,
            "kind": "candidate-topic",
            "description": None,
            "confidence": min(0.85, 0.35 + math.log10(1 + score) / 3),
            "evidence": [{
                "passageId": passages[index_value]["passageId"],
                "quoteHash": passages[index_value]["anchor"]["quoteHash"],
                "weight": 1,
            } for index_value in passage_indexes[:MAX_CONCEPT_EVIDENCE]],
            "generatedBy": {
                "extractor": SEMANTIC_VERSION,
                "mode": "deterministic-native",
            },
            "userState": {"hidden": False, "labelOverride": None},
        })
    section_first_passages = {}
    for passage in passages:
        section_index = passage["structure"]["sectionIndex"]
        if section_index not in section_first_passages:
            section_first_passages[section_index] = passage
    scenes = []
    for index, passage in enumerate(
        list(section_first_passages.values())[:MAX_SCENES]
    ):
        scenes.append({
            "sceneId": f"scene_{work_id}_{index + 1}",
            "workId": work_id,
            "label": (
                passage["structure"].get("label")
                or f"Section {passage['structure']['sectionIndex'] + 1}"
            ),
            "kind": "section-opening",
            "description": passage["text"][:320],
            "evidence": [{
                "passageId": passage["passageId"],
                "quoteHash": passage["anchor"]["quoteHash"],
                "weight": 1,
            }],
            "generatedBy": {
                "extractor": SEMANTIC_VERSION,
                "mode": "deterministic-native",
            },
            "userState": {"hidden": False, "labelOverride": None},
        })
    return {
        "schemaVersion": 2,
        "recordType": "books.semantic-records",
        "extractorVersion": SEMANTIC_VERSION,
        "workId": work_id,
        "concepts": concepts,
        "scenes": scenes,
    }


def idea_records(work_id: str, semantics: dict, passages: list, fingerprint: str):
    passage_by_id = {passage["passageId"]: passage for passage in passages}
    ideas = []
    for concept in semantics.get("concepts", []):
        evidence = []
        for reference in concept.get("evidence", []):
            passage = passage_by_id.get(reference.get("passageId"))
            if not passage:
                continue
            evidence.append({
                "passageId": passage["passageId"],
                "quoteHash": reference.get("quoteHash") or passage["anchor"]["quoteHash"],
                "excerpt": passage["text"][:420],
                "weight": reference.get("weight") or 1,
            })
        if not evidence:
            continue
        label = concept.get("label", "").strip()
        ideas.append({
            "ideaId": f"idea_{work_id}_{concept['conceptId']}",
            "workId": work_id,
            "sourceConceptId": concept["conceptId"],
            "kind": "topic" if concept.get("kind") == "candidate-topic" else concept.get("kind", "idea"),
            "label": label,
            "statement": concept.get("description") or label,
            "qualifiers": concept.get("qualifiers", []),
            "entities": concept.get("entities", []),
            "confidence": concept.get("confidence") or 0,
            "evidence": evidence,
            "generatedBy": {
                "extractor": IDEA_VERSION,
                "sourceExtractor": concept.get("generatedBy", {}).get("extractor"),
                "mode": concept.get("generatedBy", {}).get("mode", "deterministic-native"),
            },
            "userState": concept.get("userState", {
                "hidden": False, "labelOverride": None, "mergedInto": None
            }),
        })
    return {
        "schemaVersion": 1,
        "recordType": "books.idea-records",
        "extractorVersion": IDEA_VERSION,
        "workId": work_id,
        "sourceFingerprint": fingerprint,
        "ideas": ideas,
        "updatedAt": timestamp(),
    }


def embedding_text(idea: dict) -> str:
    values = [
        idea.get("label"),
        idea.get("statement"),
        *idea.get("qualifiers", []),
        *[
            entity if isinstance(entity, str) else entity.get("name")
            for entity in idea.get("entities", [])
        ],
    ]
    return ". ".join(dict.fromkeys(
        str(value).strip() for value in values if value and str(value).strip()
    ))[:1600]


class Embedder:
    def __init__(self, args):
        self.args = args
        self.native_model = None
        if args.no_embeddings:
            self.mode = "none"
        elif args.endpoint:
            self.mode = "endpoint"
        else:
            try:
                from sentence_transformers import SentenceTransformer
                self.native_model = SentenceTransformer(args.embedding_model)
                self.mode = "sentence-transformers"
            except ImportError:
                print(
                    "Embedding skipped: install sentence-transformers or pass --endpoint.",
                    file=sys.stderr,
                )
                self.mode = "none"

    @property
    def model_name(self):
        if self.args.embedding_model in {
            "all-MiniLM-L6-v2",
            "sentence-transformers/all-MiniLM-L6-v2",
        }:
            return "Xenova/all-MiniLM-L6-v2"
        return self.args.embedding_model

    def embed(self, values: list[str]) -> list[list[float]]:
        if not values:
            return []
        if self.mode == "sentence-transformers":
            result = self.native_model.encode(
                values,
                normalize_embeddings=True,
                batch_size=self.args.batch_size,
                show_progress_bar=len(values) > self.args.batch_size,
                convert_to_numpy=True,
            )
            return result.astype("float32").tolist()
        if self.mode == "endpoint":
            vectors = endpoint_embeddings(
                self.args.endpoint,
                self.args.embedding_model,
                values,
                self.args.api_key,
            )
            normalized = []
            for vector in vectors:
                norm = math.sqrt(sum(float(value) ** 2 for value in vector)) or 1
                normalized.append([float(value) / norm for value in vector])
            return normalized
        return []


def endpoint_embeddings(endpoint: str, model: str, values: list[str], api_key: str | None):
    base = endpoint.rstrip("/")
    if base.endswith(":11434") or base.endswith(":11434/v1") is False and "11434" in base:
        url = base.removesuffix("/v1") + "/api/embed"
        payload = {"model": model, "input": values}
        response = post_json(url, payload, api_key)
        return response.get("embeddings") or []
    url = base + ("/embeddings" if base.endswith("/v1") else "/v1/embeddings")
    response = post_json(url, {"model": model, "input": values}, api_key)
    rows = sorted(response.get("data", []), key=lambda row: row.get("index", 0))
    return [row["embedding"] for row in rows]


def post_json(url: str, payload: dict, api_key: str | None):
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = "Bearer " + api_key
    req = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with request.urlopen(req, timeout=300) as response:
        return json.loads(response.read().decode("utf-8"))


def extract_model_semantics(args, work_id: str, title: str, passages: list[dict]):
    if not args.chat_model or not args.endpoint:
        return []
    selected = []
    used = 0
    for passage in passages:
        excerpt = passage["text"][:1200]
        if used + len(excerpt) > 14_000:
            break
        selected.append({
            "passageId": passage["passageId"],
            "text": excerpt,
        })
        used += len(excerpt)
    if not selected:
        return []
    system = (
        "Extract the central source-grounded ideas from this book. Return JSON "
        "only with {\"ideas\":[{\"label\":string,\"kind\":"
        "\"claim|mechanism|principle|question|theme|motif|relationship|event\","
        "\"statement\":string,\"confidence\":number,"
        "\"evidencePassageIds\":[string]}]}. Every idea must cite one or more "
        "provided passage IDs. Do not invent evidence."
    )
    user = json.dumps({"title": title, "passages": selected}, ensure_ascii=False)
    base = args.endpoint.rstrip("/")
    if "11434" in base and not base.endswith("/v1"):
        result = post_json(
            base + "/api/chat",
            {
                "model": args.chat_model,
                "stream": False,
                "format": "json",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            },
            args.api_key,
        )
        content = result.get("message", {}).get("content", "")
    else:
        url = base + (
            "/chat/completions"
            if base.endswith("/v1")
            else "/v1/chat/completions"
        )
        result = post_json(
            url,
            {
                "model": args.chat_model,
                "temperature": 0.1,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            },
            args.api_key,
        )
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.I)
    parsed = json.loads(content)
    passage_by_id = {passage["passageId"]: passage for passage in passages}
    concepts = []
    for index, idea in enumerate(parsed.get("ideas", [])[:32]):
        evidence_ids = [
            passage_id for passage_id in idea.get("evidencePassageIds", [])
            if passage_id in passage_by_id
        ]
        label = str(idea.get("label") or "").strip()
        statement = str(idea.get("statement") or "").strip()
        if not label or not statement or not evidence_ids:
            continue
        concepts.append({
            "conceptId": f"concept_{work_id}_native_model_{index + 1}",
            "workId": work_id,
            "label": label[:160],
            "kind": str(idea.get("kind") or "idea"),
            "description": statement[:1200],
            "confidence": max(0, min(1, float(idea.get("confidence") or 0.65))),
            "evidence": [{
                "passageId": passage_id,
                "quoteHash": passage_by_id[passage_id]["anchor"]["quoteHash"],
                "weight": 1,
            } for passage_id in evidence_ids[:6]],
            "generatedBy": {
                "extractor": "native-model-ideas-v1",
                "mode": "local-endpoint",
                "model": args.chat_model,
            },
            "userState": {"hidden": False, "labelOverride": None},
        })
    return concepts


def make_manifest(relative: str) -> dict:
    created = timestamp()
    work_id = record_id("work")
    edition_id = record_id("edition")
    asset_id = record_id("asset")
    return {
        "schemaVersion": 1,
        "recordType": "books.work",
        "workId": work_id,
        "title": re.sub(r"\.[a-z0-9]+$", "", relative, flags=re.I),
        "authors": [],
        "metadataProvenance": {"title": "filename", "authors": None},
        "userMetadata": {"rating": None, "tags": [], "shelves": []},
        "editions": [{
            "editionId": edition_id,
            "language": None,
            "identifiers": {},
            "assetIds": [asset_id],
            "createdAt": created,
            "updatedAt": created,
        }],
        "assets": [{
            "assetId": asset_id,
            "editionId": edition_id,
            "sourcePath": "library/" + relative,
            "sourceFilename": relative,
            "format": Path(relative).suffix.lower().lstrip("."),
            "byteLength": None,
            "fingerprint": None,
            "fingerprintStatus": "pending",
            "availability": "available",
            "importedAt": created,
            "updatedAt": created,
        }],
        "legacy": {
            "bookIds": [legacy_book_id(relative)],
            "sourceFilenames": [relative],
            "sidecarPath": None,
        },
        "createdAt": created,
        "updatedAt": created,
    }


def load_manifests(sidecar: Path) -> list[dict]:
    return [
        value for value in (
            read_json(path)
            for path in sorted((sidecar / "catalog" / "works").glob("*.json"))
        )
        if isinstance(value, dict) and value.get("workId")
    ]


def reconcile_manifests(sidecar: Path, inventory: dict) -> list[dict]:
    manifests = load_manifests(sidecar)
    by_filename = {}
    recovered_missing_paths = set()
    for manifest in manifests:
        if manifest.get("recordState") == "merged":
            continue
        for asset in manifest.get("assets", []):
            if asset.get("availability") not in {"trashed", "removed"}:
                by_filename.setdefault(asset.get("sourceFilename"), (manifest, asset))

    missing_by_fingerprint = {}
    for missing in inventory.get("missing", []):
        if missing.get("fingerprint"):
            missing_by_fingerprint.setdefault(missing["fingerprint"], []).append(missing)

    for row in inventory["files"]:
        relative = row["relativePath"]
        if relative not in by_filename:
            candidates = [
                candidate
                for candidate in missing_by_fingerprint.get(
                    row.get("fingerprint"), []
                )
                if candidate["relativePath"] in by_filename
            ]
            if len(candidates) == 1 and candidates[0]["relativePath"] in by_filename:
                old = candidates[0]["relativePath"]
                manifest, asset = by_filename.pop(old)
                asset["sourceFilename"] = relative
                asset["sourcePath"] = "library/" + relative
                asset["availability"] = "available"
                asset["updatedAt"] = timestamp()
                manifest.setdefault("legacy", {}).setdefault("sourceFilenames", [])
                manifest["legacy"]["sourceFilenames"] = sorted(set(
                    manifest["legacy"]["sourceFilenames"] + [old, relative]
                ))
                manifest["updatedAt"] = asset["updatedAt"]
                by_filename[relative] = (manifest, asset)
                recovered_missing_paths.add(old)

    for row in inventory["files"]:
        relative = row["relativePath"]
        known = by_filename.get(relative)
        if not known:
            manifest = make_manifest(relative)
            manifests.append(manifest)
            known = (manifest, manifest["assets"][0])
            by_filename[relative] = known
        manifest, asset = known
        asset.update({
            "sourcePath": "library/" + relative,
            "sourceFilename": relative,
            "format": row["format"],
            "byteLength": row["byteLength"],
            "fingerprint": row["fingerprint"],
            "fingerprintStatus": row.get("fingerprintStatus") or "pending",
            "availability": "available",
            "updatedAt": timestamp(),
        })
        manifest["updatedAt"] = asset["updatedAt"]

    current = {row["relativePath"] for row in inventory["files"]}
    for manifest in manifests:
        for asset in manifest.get("assets", []):
            if (
                asset.get("sourceFilename") not in current
                and asset.get("availability") not in {"trashed", "removed"}
            ):
                asset["availability"] = "missing"
                asset["updatedAt"] = timestamp()
                manifest["updatedAt"] = asset["updatedAt"]

    for manifest in manifests:
        atomic_json(
            sidecar / "catalog" / "works" / f"{manifest['workId']}.json",
            manifest,
        )
    if recovered_missing_paths:
        inventory["missing"] = [
            record for record in inventory.get("missing", [])
            if record.get("relativePath") not in recovered_missing_paths
        ]
        inventory.setdefault("counts", {})["missing"] = len(
            inventory["missing"]
        )
    return manifests


def rebuild_catalog(sidecar: Path, manifests: list[dict]) -> dict:
    works = []
    aliases = {"sourceFilenames": {}, "legacyBookIds": {}}
    for manifest in manifests:
        if manifest.get("recordState") == "merged":
            continue
        assets = [
            asset for asset in manifest.get("assets", [])
            if asset.get("availability") in {"available", "missing"}
        ]
        for asset in assets:
            aliases["sourceFilenames"][asset["sourceFilename"]] = manifest["workId"]
        for book_id in manifest.get("legacy", {}).get("bookIds", []):
            aliases["legacyBookIds"][book_id] = manifest["workId"]
        works.append({
            "workId": manifest["workId"],
            "title": manifest.get("title") or "Untitled",
            "authors": manifest.get("authors", []),
            "formats": sorted(set(asset.get("format") for asset in assets if asset.get("format"))),
            "sourceFilenames": [asset["sourceFilename"] for asset in assets],
            "assetCount": len(assets),
            "availableAssetCount": sum(
                asset.get("availability") == "available" for asset in assets
            ),
            "updatedAt": manifest.get("updatedAt"),
        })
    catalog = {
        "schemaVersion": 1,
        "recordType": "books.catalog",
        "works": sorted(works, key=lambda work: (work["title"].lower(), work["workId"])),
        "aliases": aliases,
        "updatedAt": timestamp(),
    }
    atomic_json(sidecar / "catalog" / "catalog.json", catalog)
    return catalog


def job_record(
    manifest: dict,
    asset: dict,
    stages: dict,
    error: str | None = None,
    previous: dict | None = None,
    lease: dict | None = None,
    checkpoint: dict | None = None,
):
    previous = previous or {}
    updated = timestamp()
    artifacts = {
        name: value["artifact"]
        for name, value in stages.items()
        if isinstance(value, dict) and isinstance(value.get("artifact"), dict)
    }
    return {
        "schemaVersion": 2,
        "recordType": "books.processing-run",
        "pipelineVersion": PIPELINE_VERSION,
        "workId": manifest["workId"],
        "assetId": asset["assetId"],
        "priority": "background",
        "executorClass": "native",
        "sourceFingerprint": asset.get("fingerprint"),
        "lease": lease,
        "cancelRequested": previous.get("cancelRequested") is True,
        "checkpoint": checkpoint,
        "artifacts": {**previous.get("artifacts", {}), **artifacts},
        "stages": stages,
        "createdAt": previous.get("createdAt") or updated,
        "updatedAt": updated,
        **({"error": error} if error else {}),
    }


def process_work(root: Path, sidecar: Path, manifest: dict, embedder: Embedder, force: bool):
    asset = next(
        (item for item in manifest.get("assets", []) if item.get("availability") == "available"),
        None,
    )
    if not asset:
        return None
    work_id = manifest["workId"]
    existing_job = read_json(sidecar / "jobs" / f"{work_id}.json", {})
    if asset.get("fingerprintStatus") != "complete":
        stages = {
            "fingerprint": {
                "status": "waiting-for-stable-source",
                "attempts": int(
                    existing_job.get("stages", {})
                    .get("fingerprint", {})
                    .get("attempts", 0)
                ),
                "error": "The source changed during scanning; retry on the next diff.",
            },
            "passages": {"status": "pending", "attempts": 0},
            "lexicalIndex": {"status": "pending", "attempts": 0},
            "deterministicSemantics": {"status": "pending", "attempts": 0},
            "modelSemantics": {"status": "waiting-for-provider", "attempts": 0},
            "embeddings": {"status": "waiting-for-model", "attempts": 0},
            "libraryLinks": {"status": "blocked-by-embeddings", "attempts": 0},
        }
        atomic_json(
            sidecar / "jobs" / f"{work_id}.json",
            job_record(
                manifest,
                asset,
                stages,
                error=stages["fingerprint"]["error"],
                previous=existing_job,
            ),
        )
        return None
    executor_id = native_executor_id()
    existing_lease = existing_job.get("lease") or {}
    lease_expiry = parse_timestamp(existing_lease.get("expiresAt"))
    if (
        lease_expiry
        and lease_expiry > datetime.now(timezone.utc)
        and existing_lease.get("executorId") != executor_id
    ):
        print(
            f"  {asset['sourceFilename']}: skipped; leased by "
            f"{existing_lease.get('executorId')}",
            file=sys.stderr,
        )
        return None
    if existing_job.get("cancelRequested") is True and not force:
        print(
            f"  {asset['sourceFilename']}: processing is cancelled; use --force to resume",
            file=sys.stderr,
        )
        return None
    if force:
        existing_job["cancelRequested"] = False
    embedding_path = sidecar / "indexes" / "idea-embeddings" / f"{work_id}.json"
    vector_path = sidecar / "indexes" / "idea-embeddings" / f"{work_id}.f32"
    existing_embedding = read_json(embedding_path, {})
    embedding_available = (
        embedding_path.exists()
        and (
            (
                bool(existing_embedding.get("rows"))
                and all(
                    isinstance(row.get("vector"), list)
                    for row in existing_embedding.get("rows", [])
                )
            )
            or (
                sidecar
                / (
                    existing_embedding.get("vectorPath")
                    or f"indexes/idea-embeddings/{work_id}.f32"
                )
            ).exists()
        )
    )
    if (
        not force
        and existing_job.get("pipelineVersion") == PIPELINE_VERSION
        and existing_job.get("sourceFingerprint") == asset.get("fingerprint")
        and (sidecar / "semantic" / work_id / "ideas.json").exists()
        and (
            embedder.mode == "none"
            or (
                embedding_available
                and existing_embedding.get("indexVersion") == "idea-embeddings-v2"
                and existing_embedding.get("model") == embedder.model_name
            )
        )
    ):
        return read_json(sidecar / "semantic" / work_id / "ideas.json")

    stages = {
        "fingerprint": {"status": "complete", "attempts": 1},
        "passages": {"status": "running", "attempts": 1},
        "lexicalIndex": {"status": "pending", "attempts": 0},
        "deterministicSemantics": {"status": "pending", "attempts": 0},
        "modelSemantics": {"status": "waiting-for-provider", "attempts": 0},
        "embeddings": {
            "status": "waiting-for-model" if embedder.mode == "none" else "pending",
            "attempts": 0,
        },
        "libraryLinks": {"status": "blocked-by-embeddings", "attempts": 0},
    }
    job_path = sidecar / "jobs" / f"{work_id}.json"
    lease_claimed_at = timestamp()

    def persist_job(checkpoint=None, error=None, release=False, honor_cancel=True):
        nonlocal existing_job
        disk_job = read_json(job_path, {})
        if disk_job.get("cancelRequested") is True and not force:
            existing_job["cancelRequested"] = True
        if honor_cancel and existing_job.get("cancelRequested") is True and not force:
            raise ProcessingCancelled("Processing cancelled")
        renewed = timestamp()
        lease = None if release else {
            "executorId": executor_id,
            "executorClass": "native",
            "claimedAt": existing_lease.get("claimedAt") or lease_claimed_at,
            "renewedAt": renewed,
            "expiresAt": (
                datetime.now(timezone.utc) + timedelta(minutes=15)
            ).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        }
        existing_job = job_record(
            manifest,
            asset,
            stages,
            error,
            previous=existing_job,
            lease=lease,
            checkpoint=checkpoint,
        )
        atomic_json(job_path, existing_job)

    persist_job({"stage": "passages"})
    try:
        source = root / asset["sourceFilename"]
        sections = extract_sections(source, asset["format"])
        passages = segment_sections(work_id, asset["assetId"], asset["format"], sections)
        passage_record = {
            "schemaVersion": 1,
            "recordType": "books.passages",
            "extractorVersion": PASSAGE_VERSION,
            "workId": work_id,
            "assetId": asset["assetId"],
            "passages": passages,
            "updatedAt": timestamp(),
        }
        atomic_json(sidecar / "semantic" / work_id / "passages.json", passage_record)
        stages["passages"] = {
            "status": "complete",
            "attempts": 1,
            "passageCount": len(passages),
            "extractorVersion": PASSAGE_VERSION,
            "artifact": {
                "kind": "passages",
                "path": f"semantic/{work_id}/passages.json",
                "version": PASSAGE_VERSION,
                "sourceFingerprint": asset["fingerprint"],
            },
        }
        stages["lexicalIndex"] = {"status": "running", "attempts": 1}
        persist_job({"stage": "lexicalIndex"})

        index = lexical_index(
            work_id,
            manifest.get("title", ""),
            manifest.get("authors", []),
            passages,
        )
        index["assetId"] = asset["assetId"]
        index["updatedAt"] = timestamp()
        atomic_json(sidecar / "indexes" / "works" / f"{work_id}.json", index)
        stages["lexicalIndex"] = {
            "status": "complete",
            "attempts": 1,
            "termCount": len(index["postings"]),
            "indexVersion": LEXICAL_VERSION,
            "artifact": {
                "kind": "lexical-index",
                "path": f"indexes/works/{work_id}.json",
                "version": LEXICAL_VERSION,
                "sourceFingerprint": asset["fingerprint"],
            },
        }
        stages["deterministicSemantics"] = {"status": "running", "attempts": 1}
        persist_job({"stage": "deterministicSemantics"})

        semantics = deterministic_semantics(work_id, passages, index)
        if embedder.args.chat_model and embedder.args.endpoint:
            model_concepts = extract_model_semantics(
                embedder.args,
                work_id,
                manifest.get("title") or asset["sourceFilename"],
                passages,
            )
            semantics["concepts"].extend(model_concepts)
            stages["modelSemantics"] = {
                "status": "complete",
                "attempts": 1,
                "conceptCount": len(model_concepts),
                "model": embedder.args.chat_model,
                "provider": embedder.args.endpoint,
            }
        semantics.update({
            "assetId": asset["assetId"],
            "sourceFingerprint": asset["fingerprint"],
            "updatedAt": timestamp(),
        })
        atomic_json(sidecar / "semantic" / work_id / "records.json", semantics)
        stages["deterministicSemantics"] = {
            "status": "complete",
            "attempts": 1,
            "conceptCount": len(semantics["concepts"]),
            "sceneCount": len(semantics["scenes"]),
            "extractorVersion": SEMANTIC_VERSION,
            "artifact": {
                "kind": "semantic-records",
                "path": f"semantic/{work_id}/records.json",
                "version": SEMANTIC_VERSION,
                "sourceFingerprint": asset["fingerprint"],
            },
        }

        ideas = idea_records(work_id, semantics, passages, asset["fingerprint"])
        atomic_json(sidecar / "semantic" / work_id / "ideas.json", ideas)
        if embedder.mode != "none":
            stages["embeddings"] = {"status": "running", "attempts": 1}
            persist_job({"stage": "embeddings"})
            embedding_values = [embedding_text(idea) for idea in ideas["ideas"]]
            vectors = embedder.embed(embedding_values)
            dimensions = len(vectors[0]) if vectors else 0
            embeddings = {
                "schemaVersion": 1,
                "recordType": "books.idea-embeddings",
                "indexVersion": "idea-embeddings-v2",
                "workId": work_id,
                "model": embedder.model_name,
                "dimensions": dimensions,
                "normalized": True,
                "sourceFingerprint": asset["fingerprint"],
                "inputFingerprint": text_hash("\x1f".join(embedding_values)),
                "encoding": EMBEDDING_ENCODING,
                "vectorPath": f"indexes/idea-embeddings/{work_id}.f32",
                "rows": [
                    {"ideaId": idea["ideaId"], "index": index}
                    for index, idea in enumerate(ideas["ideas"])
                ],
                "updatedAt": timestamp(),
            }
            atomic_vector_shard(vector_path, vectors, dimensions)
            atomic_json(embedding_path, embeddings)
            stages["embeddings"] = {
                "status": "complete",
                "attempts": 1,
                "ideaCount": len(ideas["ideas"]),
                "model": embedder.model_name,
                "dimensions": dimensions,
                "artifact": {
                    "kind": "idea-embeddings",
                    "path": f"indexes/idea-embeddings/{work_id}.json",
                    "vectorPath": f"indexes/idea-embeddings/{work_id}.f32",
                    "version": "idea-embeddings-v2",
                    "model": embedder.model_name,
                    "dimensions": dimensions,
                    "sourceFingerprint": asset["fingerprint"],
                },
            }
        persist_job(release=True)
        return ideas
    except ProcessingCancelled as error:
        running = next(
            (name for name, value in stages.items() if value.get("status") == "running"),
            "passages",
        )
        stages[running] = {
            **stages[running],
            "status": "cancelled",
            "error": str(error),
        }
        persist_job(error=str(error), release=True, honor_cancel=False)
        print(f"  {asset['sourceFilename']}: processing cancelled", file=sys.stderr)
        return None
    except Exception as error:
        running = next(
            (name for name, value in stages.items() if value.get("status") == "running"),
            "passages",
        )
        stages[running] = {
            **stages[running],
            "status": "waiting-for-ocr"
            if "OCR is required" in str(error)
            else "failed",
            "error": str(error),
        }
        persist_job(error=str(error), release=True, honor_cancel=False)
        print(f"  {asset['sourceFilename']}: {error}", file=sys.stderr)
        return None


def cosine(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left:
        return 0.0
    return sum(a * b for a, b in zip(left, right)) / (
        math.sqrt(sum(a * a for a in left))
        * math.sqrt(sum(b * b for b in right))
        + 1e-12
    )


def normalize_idea_text(value) -> str:
    normalized = unicodedata.normalize("NFKC", str(value or "")).lower()
    return " ".join(
        "".join(
            character if character.isalnum() else " "
            for character in normalized
        ).split()
    )


def classify_idea_relation(left: dict, right: dict, similarity: float):
    left_label = normalize_idea_text(left.get("label"))
    right_label = normalize_idea_text(right.get("label"))
    left_statement = normalize_idea_text(left.get("statement"))
    right_statement = normalize_idea_text(right.get("statement"))
    if (
        left_label
        and (
            left_label == right_label
            or (
                left_statement
                and left_statement == right_statement
            )
        )
    ):
        return "same_as", "exact-normalized-idea"
    if (
        similarity >= 0.82
        and left_statement
        and right_statement
        and (
            left_statement in right_statement
            or right_statement in left_statement
        )
    ):
        return "extends", "semantic-containment"
    return "related_to", "embedding-neighbour"


def vector_bucket_signature(vector: list[float], table: int, bits: int = 8):
    if not vector:
        return None
    signature = 0
    for bit in range(bits):
        dimension = (
            7 + table * 53 + bit * 37 + table * bit * 11
        ) % len(vector)
        if float(vector[dimension]) >= 0:
            signature |= 1 << bit
    return signature


def scalable_candidate_rows(ideas: list[dict], vectors: dict, maximum: int = 768):
    tables = 6
    bits = 8
    buckets = [{} for _ in range(tables)]
    signatures = []
    for index, idea in enumerate(ideas):
        vector = vectors.get(idea["ideaId"], [])
        row = []
        for table in range(tables):
            signature = vector_bucket_signature(vector, table, bits)
            row.append(signature)
            if signature is not None:
                buckets[table].setdefault(signature, []).append(index)
        signatures.append(row)

    def candidates(index: int):
        values = set()
        for table in range(tables):
            signature = signatures[index][table]
            if signature is None:
                continue
            signatures_to_try = [signature] + [
                signature ^ (1 << bit) for bit in range(bits)
            ]
            for alternate in signatures_to_try:
                for candidate in buckets[table].get(alternate, []):
                    if candidate > index:
                        values.add(candidate)
                    if len(values) >= maximum:
                        return sorted(values)
        return sorted(values)

    return candidates


def build_graph(sidecar: Path, manifests: list[dict], model_name: str):
    ideas = []
    vectors = {}
    dimensions = 0
    for manifest in manifests:
        work_id = manifest["workId"]
        idea_record = read_json(sidecar / "semantic" / work_id / "ideas.json", {})
        embedding_record = read_json(
            sidecar / "indexes" / "idea-embeddings" / f"{work_id}.json", {}
        )
        if embedding_record.get("model") != model_name:
            continue
        ideas.extend(idea_record.get("ideas", []))
        dimensions = embedding_record.get("dimensions") or dimensions
        rows = embedding_record.get("rows", [])
        if rows and all(isinstance(row.get("vector"), list) for row in rows):
            work_vectors = [row["vector"] for row in rows]
        else:
            vector_path = embedding_record.get("vectorPath") or (
                f"indexes/idea-embeddings/{work_id}.f32"
            )
            try:
                work_vectors = read_vector_shard(
                    sidecar / vector_path,
                    len(rows),
                    int(embedding_record.get("dimensions") or 0),
                )
            except (OSError, ValueError) as error:
                print(f"Skipping unreadable vectors for {work_id}: {error}", file=sys.stderr)
                continue
        for fallback_index, row in enumerate(rows):
            index = row.get("index", fallback_index)
            if isinstance(index, int) and 0 <= index < len(work_vectors):
                vectors[row["ideaId"]] = work_vectors[index]

    scalable = len(ideas) > 2_048
    candidate_rows = scalable_candidate_rows(ideas, vectors) if scalable else None
    links = []
    for left_index, left in enumerate(ideas):
        candidates = []
        right_indexes = (
            candidate_rows(left_index)
            if candidate_rows
            else range(left_index + 1, len(ideas))
        )
        for right_index in right_indexes:
            right = ideas[right_index]
            if left["workId"] == right["workId"]:
                continue
            score = cosine(vectors.get(left["ideaId"], []), vectors.get(right["ideaId"], []))
            if score >= LIBRARY_LINK_MIN_SCORE:
                candidates.append((score, right))
        for score, right in sorted(
            candidates,
            key=lambda row: (-row[0], row[1]["ideaId"]),
        )[:LIBRARY_LINKS_PER_IDEA]:
            relation, method = classify_idea_relation(left, right, score)
            key = "\u001f".join(sorted([left["ideaId"], right["ideaId"]]))
            links.append({
                "linkId": "idea-link_" + re.sub(r"[^\w-]+", "_", key),
                "leftIdeaId": left["ideaId"],
                "rightIdeaId": right["ideaId"],
                "leftWorkId": left["workId"],
                "rightWorkId": right["workId"],
                "relation": relation,
                "score": round(score, 6),
                "evidence": {
                    "leftPassageIds": [
                        row["passageId"] for row in left.get("evidence", [])
                    ],
                    "rightPassageIds": [
                        row["passageId"] for row in right.get("evidence", [])
                    ],
                },
                "generatedBy": {
                    "method": method,
                    "model": model_name,
                    "dimensions": dimensions,
                },
                "userState": {"hidden": False, "relationOverride": None},
            })
    unique = {link["linkId"]: link for link in links}
    graph = {
        "schemaVersion": 1,
        "recordType": "books.library-idea-graph",
        "model": model_name,
        "dimensions": dimensions,
        "candidateStrategy": (
            "multi-table-signature-v1" if scalable else "exact-all-pairs"
        ),
        "ideaCount": len(ideas),
        "links": sorted(unique.values(), key=lambda link: (-link["score"], link["linkId"])),
        "updatedAt": timestamp(),
    }
    atomic_json(sidecar / "indexes" / "library-idea-graph.json", graph)
    return graph


def complete_graph_jobs(sidecar: Path, manifests: list[dict], graph: dict):
    for manifest in manifests:
        work_id = manifest["workId"]
        path = sidecar / "jobs" / f"{work_id}.json"
        job = read_json(path)
        if not isinstance(job, dict):
            continue
        link_count = sum(
            link.get("leftWorkId") == work_id or link.get("rightWorkId") == work_id
            for link in graph.get("links", [])
        )
        stage = {
            **job.get("stages", {}).get("libraryLinks", {}),
            "status": "complete",
            "linkCount": link_count,
            "graphPath": "indexes/library-idea-graph.json",
            "graphVersion": GRAPH_VERSION,
            "updatedAt": timestamp(),
            "artifact": {
                "kind": "library-idea-links",
                "path": "indexes/library-idea-graph.json",
                "version": GRAPH_VERSION,
                "model": graph.get("model"),
            },
        }
        job.setdefault("stages", {})["libraryLinks"] = stage
        job.setdefault("artifacts", {})["libraryLinks"] = stage["artifact"]
        job["updatedAt"] = stage["updatedAt"]
        atomic_json(path, job)


def classify_graph(args, sidecar: Path, graph: dict):
    if not args.chat_model or not args.endpoint:
        return graph
    idea_by_id = {}
    for path in (sidecar / "semantic").glob("*/ideas.json"):
        for idea in read_json(path, {}).get("ideas", []):
            idea_by_id[idea["ideaId"]] = idea
    candidates = [
        link for link in graph.get("links", [])
        if link.get("relation") in {"related_to", "extends"}
    ][:96]
    for offset in range(0, len(candidates), 16):
        batch = candidates[offset:offset + 16]
        pairs = []
        for link in batch:
            left = idea_by_id.get(link["leftIdeaId"], {})
            right = idea_by_id.get(link["rightIdeaId"], {})
            pairs.append({
                "linkId": link["linkId"],
                "left": {
                    "label": left.get("label"),
                    "statement": left.get("statement"),
                    "kind": left.get("kind"),
                },
                "right": {
                    "label": right.get("label"),
                    "statement": right.get("statement"),
                    "kind": right.get("kind"),
                },
            })
        system = (
            "Classify each directed relationship from left idea to right idea. "
            "Use only: " + ", ".join(sorted(RELATION_TYPES)) + ". Return JSON "
            "only as {\"relations\":[{\"linkId\":string,\"relation\":string,"
            "\"confidence\":number,\"rationale\":string}]}. Use related_to "
            "when evidence is insufficient. Do not create IDs."
        )
        base = args.endpoint.rstrip("/")
        if "11434" in base and not base.endswith("/v1"):
            response = post_json(
                base + "/api/chat",
                {
                    "model": args.chat_model,
                    "stream": False,
                    "format": "json",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": json.dumps({"pairs": pairs})},
                    ],
                },
                args.api_key,
            )
            content = response.get("message", {}).get("content", "")
        else:
            response = post_json(
                base + (
                    "/chat/completions"
                    if base.endswith("/v1")
                    else "/v1/chat/completions"
                ),
                {
                    "model": args.chat_model,
                    "temperature": 0.1,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": json.dumps({"pairs": pairs})},
                    ],
                },
                args.api_key,
            )
            content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        parsed = json.loads(re.sub(
            r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.I
        ))
        classifications = {
            row.get("linkId"): row
            for row in parsed.get("relations", [])
            if (
                row.get("relation") in RELATION_TYPES
                and max(0, min(1, float(row.get("confidence") or 0)))
                >= RELATION_CLASSIFICATION_MIN_CONFIDENCE
            )
        }
        for link in graph["links"]:
            row = classifications.get(link["linkId"])
            if not row:
                continue
            link["relation"] = row["relation"]
            link["classification"] = {
                "confidence": max(0, min(1, float(row.get("confidence") or 0))),
                "rationale": str(row.get("rationale") or "")[:500] or None,
                "provider": args.endpoint,
                "model": args.chat_model,
                "classifiedAt": timestamp(),
            }
            link.setdefault("generatedBy", {})[
                "relationMethod"
            ] = "source-grounded-model-classifier"
    graph["updatedAt"] = timestamp()
    atomic_json(sidecar / "indexes" / "library-idea-graph.json", graph)
    return graph


def ensure_library_manifest(sidecar: Path, root: Path):
    manifest_path = sidecar / "library.json"
    manifest = read_json(manifest_path)
    if manifest and manifest.get("recordType") == "books.folder-library":
        return manifest
    value = {
        "schemaVersion": 1,
        "recordType": "books.folder-library",
        "libraryId": str(uuid.uuid4()),
        "rootName": root.name,
        "sidecarDirectory": SIDECAR,
        "sourcePolicy": "read-in-place",
        "canonicalMetadata": "sidecar",
        "createdAt": timestamp(),
        "updatedAt": timestamp(),
    }
    atomic_json(manifest_path, value)
    return value


def load_latest_inventory(sidecar: Path):
    current = read_json(sidecar / "inventory" / "current.json")
    if (
        isinstance(current, dict)
        and current.get("recordType") == "books.folder-inventory"
        and current.get("completed") is True
    ):
        return current
    generation_directory = sidecar / "inventory" / "generations"
    for path in sorted(generation_directory.glob("*.json"), reverse=True):
        candidate = read_json(path)
        if (
            isinstance(candidate, dict)
            and candidate.get("recordType") == "books.folder-inventory"
            and candidate.get("completed") is True
        ):
            print(
                f"Recovered inventory from {path.name}; current.json was incomplete.",
                file=sys.stderr,
            )
            return candidate
    return None


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", help="Root of the Books folder library")
    parser.add_argument("--no-embeddings", action="store_true")
    parser.add_argument("--embedding-model", default="all-MiniLM-L6-v2")
    parser.add_argument("--endpoint", help="OpenAI-compatible or Ollama base URL")
    parser.add_argument(
        "--chat-model",
        help="Optional endpoint model for richer source-grounded idea extraction",
    )
    parser.add_argument("--api-key", default=os.environ.get("BOOKS_AI_API_KEY"))
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument(
        "--scan-attempts",
        type=int,
        default=3,
        help="Fingerprint retries when a source is changing (default: 3)",
    )
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main():
    args = parse_args()
    root = Path(args.folder).expanduser().resolve()
    if not root.is_dir():
        raise SystemExit(f"Not a directory: {root}")
    sidecar = root / SIDECAR
    sidecar.mkdir(exist_ok=True)
    ensure_library_manifest(sidecar, root)
    previous = load_latest_inventory(sidecar)
    inventory, _ = scan_sources(root, previous, max(1, args.scan_attempts))
    generation_path = (
        sidecar / "inventory" / "generations"
        / f"{inventory['generation']:08d}.json"
    )
    atomic_json(generation_path, inventory)
    atomic_json(sidecar / "inventory" / "current.json", inventory)
    manifests = reconcile_manifests(sidecar, inventory)
    atomic_json(generation_path, inventory)
    atomic_json(sidecar / "inventory" / "current.json", inventory)
    print(
        f"Inventory: {inventory['counts']['total']} books "
        f"({inventory['counts']['added']} new, "
        f"{inventory['counts']['changed']} changed, "
        f"{inventory['counts']['missing']} missing)"
    )
    rebuild_catalog(sidecar, manifests)
    embedder = Embedder(args)
    processed = 0
    for manifest in manifests:
        if manifest.get("recordState") == "merged":
            continue
        before = read_json(sidecar / "jobs" / f"{manifest['workId']}.json", {})
        result = process_work(root, sidecar, manifest, embedder, args.force)
        after = read_json(sidecar / "jobs" / f"{manifest['workId']}.json", {})
        if result is not None and before.get("updatedAt") != after.get("updatedAt"):
            processed += 1
    graph = None
    if embedder.mode != "none":
        graph = build_graph(sidecar, manifests, embedder.model_name)
        graph = classify_graph(args, sidecar, graph)
        complete_graph_jobs(sidecar, manifests, graph)
    print(
        f"Done: {processed} books processed"
        + (f", {len(graph['links'])} idea links" if graph else "")
        + f" · executor native:{socket.gethostname()}:{os.getpid()}"
    )


if __name__ == "__main__":
    main()
