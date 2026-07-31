#!/usr/bin/env python3

import importlib.util
import json
from pathlib import Path
import tempfile


module_path = Path(__file__).with_name("books-index.py")
spec = importlib.util.spec_from_file_location("books_index", module_path)
books_index = importlib.util.module_from_spec(spec)
spec.loader.exec_module(books_index)

manifests = [
    {"workId": "work-loss", "title": "The Shape of Decisions"},
    {"workId": "work-story", "title": "Mara Keeps the Shop"},
]
units = [{
    "unitId": "unit-work-loss-loss-aversion",
    "workId": "work-loss",
    "kind": "mechanism",
    "lens": "expository",
    "label": "Loss aversion",
    "statement": "Losses are weighted more heavily than equal gains.",
    "confidence": 0.92,
    "evidence": [{
        "passageId": "passage-loss",
        "paragraphId": "paragraph-loss",
        "quoteHash": "sha256:loss",
        "textHash": "sha256:text-loss",
        "excerpt": "People commonly weigh a loss more heavily than an equal gain.",
        "positionFraction": 0.1,
    }],
    "userState": {"hidden": False},
}, {
    "unitId": "unit-work-story-shop-choice",
    "workId": "work-story",
    "kind": "character-choice",
    "lens": "narrative",
    "label": "Mara refuses to surrender the shop",
    "statement": "Mara accepts further costs rather than experience surrender as a loss.",
    "confidence": 0.87,
    "evidence": [{
        "passageId": "passage-story",
        "paragraphId": "paragraph-story",
        "quoteHash": "sha256:story",
        "textHash": "sha256:text-story",
        "excerpt": "Mara keeps the failing shop because surrender feels worse than another costly year.",
        "positionFraction": 0.4,
    }],
    "userState": {"hidden": False},
}]
vectors = {
    "work-loss": [[1.0, 0.0]],
    "work-story": [[0.99, 0.01]],
}

with tempfile.TemporaryDirectory(prefix="lorewell-echo-parity-") as value:
    sidecar = Path(value)
    for manifest, unit in zip(manifests, units):
        work_id = manifest["workId"]
        books_index.atomic_json(
            sidecar / "semantic" / work_id / "units.json",
            {"workId": work_id, "units": [unit]},
        )
        books_index.atomic_json(
            sidecar / "indexes" / "echo-unit-embeddings" / f"{work_id}.json",
            {
                "workId": work_id,
                "model": "fixture",
                "dimensions": 2,
                "rows": [{
                    "unitId": unit["unitId"],
                    "index": 0,
                    "vector": vectors[work_id][0],
                }],
            },
        )
    graph, loaded_units = books_index.build_echo_graph(
        sidecar, manifests, "fixture"
    )
    records = books_index.build_reader_connections(
        sidecar, manifests, graph, loaded_units
    )
    result = {
        "graph": {
            "candidateStrategy": graph["candidateStrategy"],
            "compatibilityStrategy": graph["compatibilityStrategy"],
            "unitCount": graph["unitCount"],
            "links": [{
                "linkId": link["linkId"],
                "leftUnitId": link["leftUnitId"],
                "rightUnitId": link["rightUnitId"],
                "relation": link["relation"],
                "score": link["score"],
                "evidence": link["evidence"],
            } for link in graph["links"]],
        },
        "readers": {
            work_id: [{
                "connectionId": connection["connectionId"],
                "source": connection["source"],
                "target": connection["target"],
                "relation": connection["relation"],
                "direction": connection["direction"],
                "spoiler": connection["spoiler"],
                "evidence": connection["evidence"],
            } for connection in record["connections"]]
            for work_id, record in records.items()
        },
    }
    print(json.dumps(result, sort_keys=True))
