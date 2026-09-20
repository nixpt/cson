"""CSON node model — see SPEC.md §3.

A node is a value plus optional metadata. Unlike JSON, the value and its
metadata travel together, so the model keeps them on one object.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


class CsonError(ValueError):
    """A parse error, with position. SPEC §7 requires positional messages."""

    def __init__(self, message: str, line: int, col: int):
        self.message, self.line, self.col = message, line, col
        super().__init__(f"{message} (line {line}, column {col})")


@dataclass(frozen=True)
class Annotation:
    """`@name(args) { k: "v" }` — SPEC §4.3."""

    name: str
    args: Optional[str] = None
    properties: dict = field(default_factory=dict)


@dataclass(frozen=True)
class Synthesize:
    """`@synthesize("description")` — SPEC §4.4.

    An instruction, not data. Kept as its own type so a consumer can never
    mistake it for a literal string; §6 projects it to {"$synthesize": ...}.
    """

    description: str


@dataclass
class Node:
    """A value plus its metadata.

    `confidence` is None when unstated. SPEC §4.2 is explicit that absent is
    NOT the same as 1.0 -- absent means "no claim" -- so the two must stay
    distinguishable. Do not collapse None to 1.0 anywhere.
    """

    value: Any
    confidence: Optional[float] = None
    annotations: tuple = ()
    semantic: bool = False          # key was ~"intent", SPEC §4.1


@dataclass
class Document:
    """A parsed document: the root object plus its declared version (§2.5, §9)."""

    root: dict                      # str -> Node
    version: str = "1.0"

    def to_json(self) -> dict:
        from ._json import project
        return project(self.root)
