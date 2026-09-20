"""cson — a CSON parser for Python.

CSON (Crush Semantic Object Notation) is a JSON-shaped format with four
AI-native primitives: semantic keys, confidence, annotations and synthesized
values. See the spec: https://github.com/nixpt/cson/blob/main/SPEC.md

    >>> import cson
    >>> doc = cson.parse('temperature: 21.5 ~0.8')
    >>> doc.root['temperature'].value, doc.root['temperature'].confidence
    (21.5, 0.8)
    >>> cson.loads('tags: ["a", "b"]')
    {'tags': ['a', 'b']}
"""
from ._json import project, project_full
from ._model import Annotation, CsonError, Document, Node, Synthesize
from ._parser import parse

__all__ = ["parse", "loads", "Document", "Node", "Annotation", "Synthesize",
           "CsonError", "project", "project_full"]
__version__ = "0.1.0"


def loads(text: str) -> dict:
    """Parse and project to plain JSON-compatible data (SPEC §6).

    Use `parse()` instead when you need confidence or annotations -- this
    drops them, matching the conformance corpus.
    """
    return parse(text).to_json()
