#!/usr/bin/env python3
import importlib.util
from array import array
from pathlib import Path
import sys
import tempfile
import tracemalloc

sys.dont_write_bytecode = True
module_path = Path(__file__).with_name("books-index.py")
spec = importlib.util.spec_from_file_location("books_index", module_path)
books_index = importlib.util.module_from_spec(spec)
spec.loader.exec_module(books_index)

with tempfile.TemporaryDirectory(prefix="books-vectors-") as directory:
    path = Path(directory) / "fixture.f32"
    vectors = [[1.0, 0.0, 0.5], [0.0, 1.0, -0.25]]
    books_index.atomic_vector_shard(path, vectors, 3)
    decoded = books_index.read_vector_shard(path, 2, 3)
    # Rows are compact float32 arrays, not lists of Python float objects (H10).
    assert all(isinstance(row, array) and row.typecode == "f" for row in decoded)
    assert decoded[0].itemsize == 4
    # These values are exact in float32, so they round-trip precisely.
    assert [list(row) for row in decoded] == vectors
    assert path.read_bytes()[:4] == b"BIE1"

# H10 — reading a large shard stays memory-bounded because vectors are float32
# arrays (~4 bytes/value) instead of Python-float lists (~24 bytes/value).
with tempfile.TemporaryDirectory(prefix="books-vectors-scale-") as directory:
    big = Path(directory) / "scale.f32"
    dims = 384
    rows = 3000
    big_vectors = [
        [float((i * 7 + j) % 13) / 13.0 for j in range(dims)] for i in range(rows)
    ]
    books_index.atomic_vector_shard(big, big_vectors, dims)
    del big_vectors
    tracemalloc.start()
    decoded_big = books_index.read_vector_shard(big, rows, dims)
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    assert len(decoded_big) == rows
    assert sum(len(row) for row in decoded_big) == rows * dims
    budget = rows * dims * 8  # half the ~8 bytes/pointer a Python-float list needs
    assert peak < budget, f"shard read peak {peak} exceeded {budget}"

assert books_index.MAX_PASSAGE_CHARS == 1400
assert books_index.MAX_CONCEPTS == 16
assert books_index.MAX_SCENES == 12
assert books_index.MAX_CONCEPT_EVIDENCE == 4
assert books_index.LIBRARY_LINK_MIN_SCORE == 0.68
assert books_index.LIBRARY_LINKS_PER_IDEA == 8
assert books_index.RELATION_CLASSIFICATION_MIN_CONFIDENCE == 0.65

same_relation = books_index.classify_idea_relation(
    {"label": "Feedback loops", "statement": "Fast feedback changes behaviour"},
    {"label": "feedback loops", "statement": "A different explanation"},
    0.99,
)
assert same_relation == ("same_as", "exact-normalized-idea")
extends_relation = books_index.classify_idea_relation(
    {"label": "Feedback", "statement": "feedback changes behaviour"},
    {
        "label": "Feedback mechanism",
        "statement": "fast feedback changes behaviour over time",
    },
    0.9,
)
assert extends_relation == ("extends", "semantic-containment")

with tempfile.TemporaryDirectory(prefix="books-native-graph-") as directory:
    sidecar = Path(directory)
    manifests = [
        {"workId": "work-a", "assets": [{
            "assetId": "asset-a", "availability": "available",
            "fingerprint": "sha256:a", "fingerprintStatus": "complete",
        }]},
        {"workId": "work-b", "assets": [{
            "assetId": "asset-b", "availability": "available",
            "fingerprint": "sha256:b", "fingerprintStatus": "complete",
        }]},
    ]
    fixture_ideas = [
        {
            "ideaId": "idea_work-a_feedback",
            "workId": "work-a",
            "label": "Feedback loops",
            "statement": "Fast feedback changes behaviour.",
            "evidence": [{"passageId": "passage-a"}],
        },
        {
            "ideaId": "idea-work-b-feedback",
            "workId": "work-b",
            "label": "feedback loops",
            "statement": "A different explanation.",
            "evidence": [{"passageId": "passage-b"}],
        },
    ]
    for idea in fixture_ideas:
        work_id = idea["workId"]
        books_index.atomic_json(
            sidecar / "semantic" / work_id / "ideas.json",
            {"ideas": [idea]},
        )
        fingerprint = "sha256:a" if work_id == "work-a" else "sha256:b"
        books_index.atomic_json(
            sidecar / "jobs" / f"{work_id}.json",
            {
                "pipelineVersion": books_index.PIPELINE_VERSION,
                "sourceFingerprint": fingerprint,
                "stages": {"embeddings": {"status": "complete"}},
            },
        )
        books_index.atomic_json(
            sidecar / "indexes" / "idea-embeddings" / f"{work_id}.json",
            {
                "model": "fixture",
                "dimensions": 2,
                "rows": [{"ideaId": idea["ideaId"], "vector": [1.0, 0.0]}],
            },
        )
    native_graph = books_index.build_graph(sidecar, manifests, "fixture")
    assert len(native_graph["links"]) == 1
    pair_key = "\x1f".join(sorted([
        "idea_work-a_feedback", "idea-work-b-feedback"
    ]))
    assert native_graph["links"][0]["linkId"] == (
        "idea-link_" + books_index.pair_link_token(pair_key)
    )
    assert native_graph["links"][0]["relation"] == "same_as"

print("Books native vector-shard contract: PASS")
