#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import sys
import tempfile

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
    assert decoded == vectors
    assert path.read_bytes()[:4] == b"BIE1"

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
    manifests = [{"workId": "work-a"}, {"workId": "work-b"}]
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
    assert native_graph["links"][0]["linkId"] == (
        "idea-link_idea-work-b-feedback_idea_work-a_feedback"
    )
    assert native_graph["links"][0]["relation"] == "same_as"

print("Books native vector-shard contract: PASS")
