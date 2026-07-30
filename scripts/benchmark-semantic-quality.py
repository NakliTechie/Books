#!/usr/bin/env python3
"""Reproducible MiniLM retrieval benchmark for the Books hybrid-search weights."""

from __future__ import annotations

import argparse
import json
import math
import re
import time


CORPUS = [
    {
        "id": "feedback",
        "text": (
            "A feedback loop observes the result of an action and feeds that "
            "evidence into the next action, allowing a system to adapt."
        ),
    },
    {
        "id": "compound-interest",
        "text": (
            "Compound interest adds earned returns to the principal, so later "
            "returns are earned on both the original capital and prior gains."
        ),
    },
    {
        "id": "photosynthesis",
        "text": (
            "Photosynthesis lets plants use sunlight to convert carbon dioxide "
            "and water into stored chemical energy and oxygen."
        ),
    },
    {
        "id": "differential-privacy",
        "text": (
            "Differential privacy limits what an analysis reveals about any "
            "individual by adding carefully calibrated statistical noise."
        ),
    },
    {
        "id": "supply-demand",
        "text": (
            "When demand grows faster than available supply, competition among "
            "buyers tends to raise the market price."
        ),
    },
    {
        "id": "cognitive-bias",
        "text": (
            "Cognitive biases are systematic errors in judgment that often "
            "arise from fast mental shortcuts and incomplete evidence."
        ),
    },
    {
        "id": "plate-tectonics",
        "text": (
            "Plate tectonics explains earthquakes, mountain building, and "
            "continental movement through slowly moving slabs of Earth's crust."
        ),
    },
    {
        "id": "immune-memory",
        "text": (
            "Vaccination develops immune memory, enabling a faster and stronger "
            "response when the same pathogen appears later."
        ),
    },
    {
        "id": "nonviolent-resistance",
        "text": (
            "Nonviolent resistance pursues political change through organized "
            "civil action without using physical violence."
        ),
    },
    {
        "id": "bayesian-update",
        "text": (
            "Bayesian reasoning updates the probability of a belief when new "
            "evidence arrives, combining a prior with observed likelihood."
        ),
    },
    {
        "id": "local-first",
        "text": (
            "Local-first software keeps primary data on the user's device and "
            "uses conflict-aware synchronization for optional collaboration."
        ),
    },
    {
        "id": "hero-journey",
        "text": (
            "The hero's journey sends a protagonist away from ordinary life "
            "through trials and transformation before a changed return."
        ),
    },
]

QUERIES = [
    ("systems learn from outcomes and adjust future behaviour", "feedback"),
    ("returns earn additional returns over a long period", "compound-interest"),
    ("plants turn sunlight into chemical energy", "photosynthesis"),
    ("protect each person's records by introducing noise", "differential-privacy"),
    ("prices increase when buyers exceed available goods", "supply-demand"),
    ("judgments go wrong because of quick mental shortcuts", "cognitive-bias"),
    ("continents move on slowly shifting slabs of crust", "plate-tectonics"),
    ("vaccines train the body for a quicker later response", "immune-memory"),
    ("achieving political change without physical violence", "nonviolent-resistance"),
    ("revise the probability of a belief after new evidence", "bayesian-update"),
    ("keep primary files on device and merge sync conflicts", "local-first"),
    ("a protagonist leaves home, faces trials, and returns transformed", "hero-journey"),
]

MULTILINGUAL_DIAGNOSTICS = [
    ("पौधे सूर्य के प्रकाश को रासायनिक ऊर्जा में बदलते हैं", "photosynthesis"),
    ("les rendements produisent ensuite leurs propres rendements", "compound-interest"),
]

STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "because", "by", "for",
    "from", "in", "into", "is", "it", "of", "on", "or", "that", "the",
    "their", "through", "to", "when", "with",
}


def tokens(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[\w'’-]+", value.casefold())
        if len(token) > 2 and token not in STOP_WORDS
    }


def lexical_score(query: str, document: str) -> float:
    query_tokens = tokens(query)
    if not query_tokens:
        return 0
    return len(query_tokens & tokens(document)) / len(query_tokens)


def metrics(rankings):
    reciprocal = []
    top_one = 0
    top_three = 0
    for expected, ranking in rankings:
        rank = ranking.index(expected) + 1 if expected in ranking else math.inf
        reciprocal.append(0 if math.isinf(rank) else 1 / rank)
        top_one += rank == 1
        top_three += rank <= 3
    total = max(1, len(rankings))
    return {
        "queries": len(rankings),
        "top1": round(top_one / total, 4),
        "recallAt3": round(top_three / total, 4),
        "mrr": round(sum(reciprocal) / total, 4),
    }


def benchmark(model_name: str):
    from sentence_transformers import SentenceTransformer

    load_started = time.perf_counter()
    model = SentenceTransformer(model_name)
    load_seconds = time.perf_counter() - load_started
    documents = [row["text"] for row in CORPUS]
    encode_started = time.perf_counter()
    document_vectors = model.encode(
        documents,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    query_vectors = model.encode(
        [query for query, _ in QUERIES + MULTILINGUAL_DIAGNOSTICS],
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    encode_seconds = time.perf_counter() - encode_started

    semantic_rankings = []
    lexical_rankings = []
    hybrid_rankings = []
    details = []
    for index, (query, expected) in enumerate(QUERIES):
        semantic_scores = document_vectors @ query_vectors[index]
        lexical_scores = [
            lexical_score(query, document) for document in documents
        ]
        hybrid_scores = [
            (float(semantic_scores[row]) * 0.72)
            + (lexical_scores[row] * 0.28)
            for row in range(len(CORPUS))
        ]
        semantic_ranking = [
            CORPUS[row]["id"]
            for row in sorted(
                range(len(CORPUS)),
                key=lambda row: (-float(semantic_scores[row]), CORPUS[row]["id"]),
            )
        ]
        lexical_ranking = [
            CORPUS[row]["id"]
            for row in sorted(
                range(len(CORPUS)),
                key=lambda row: (-lexical_scores[row], CORPUS[row]["id"]),
            )
        ]
        hybrid_ranking = [
            CORPUS[row]["id"]
            for row in sorted(
                range(len(CORPUS)),
                key=lambda row: (-hybrid_scores[row], CORPUS[row]["id"]),
            )
        ]
        semantic_rankings.append((expected, semantic_ranking))
        lexical_rankings.append((expected, lexical_ranking))
        hybrid_rankings.append((expected, hybrid_ranking))
        details.append({
            "query": query,
            "expected": expected,
            "semanticTop3": semantic_ranking[:3],
            "lexicalTop3": lexical_ranking[:3],
            "hybridTop3": hybrid_ranking[:3],
        })

    multilingual = []
    offset = len(QUERIES)
    for index, (query, expected) in enumerate(MULTILINGUAL_DIAGNOSTICS):
        scores = document_vectors @ query_vectors[offset + index]
        ranking = [
            CORPUS[row]["id"]
            for row in sorted(
                range(len(CORPUS)),
                key=lambda row: (-float(scores[row]), CORPUS[row]["id"]),
            )
        ]
        multilingual.append({
            "query": query,
            "expected": expected,
            "rank": ranking.index(expected) + 1,
            "top3": ranking[:3],
        })

    dimensions = int(document_vectors.shape[1])
    result = {
        "recordType": "books.semantic-quality-benchmark",
        "schemaVersion": 1,
        "model": model_name,
        "corpusSize": len(CORPUS),
        "dimensions": dimensions,
        "float32BytesPerIdea": dimensions * 4,
        "loadSeconds": round(load_seconds, 3),
        "encodeSeconds": round(encode_seconds, 3),
        "lexical": metrics(lexical_rankings),
        "semantic": metrics(semantic_rankings),
        "hybrid": metrics(hybrid_rankings),
        "multilingualDiagnostics": multilingual,
        "details": details,
    }
    result["gatePassed"] = (
        result["semantic"]["recallAt3"] >= 0.90
        and result["hybrid"]["recallAt3"] >= 0.90
        and result["hybrid"]["mrr"] >= 0.85
    )
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model",
        default="sentence-transformers/all-MiniLM-L6-v2",
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    result = benchmark(args.model)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(
            f"Books semantic benchmark · {result['model']} · "
            f"{result['dimensions']} dimensions"
        )
        for name in ("lexical", "semantic", "hybrid"):
            row = result[name]
            print(
                f"{name}: top1 {row['top1']:.0%}, "
                f"recall@3 {row['recallAt3']:.0%}, MRR {row['mrr']:.3f}"
            )
        print(
            f"load {result['loadSeconds']:.2f}s · "
            f"encode {result['encodeSeconds']:.2f}s · "
            f"gate {'PASS' if result['gatePassed'] else 'FAIL'}"
        )
        for row in result["multilingualDiagnostics"]:
            print(
                f"multilingual diagnostic: {row['expected']} rank {row['rank']} "
                f"for {row['query']}"
            )
    raise SystemExit(0 if result["gatePassed"] else 1)


if __name__ == "__main__":
    main()
