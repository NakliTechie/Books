#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import tempfile

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

print("Books native vector-shard contract: PASS")
