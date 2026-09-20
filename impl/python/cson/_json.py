"""JSON projection — SPEC.md §6.

One rule: a node with no metadata projects to its bare value; a node carrying
confidence or annotations projects to a wrapper object

    {"$value": …, "$confidence": …, "$annotations": [ … ]}

with the metadata members omitted when absent. Because the wrapper is keyed on
the NODE and not on its parent's key, it applies identically to object values
and array elements -- an array element is a node and may carry metadata.

This keeps absent confidence distinguishable from an explicit ~1.0 (§4.2): the
`$confidence` member is present only when stated.
"""
from __future__ import annotations

from typing import Any

from ._model import CsonError, Node, Synthesize

RESERVED_PREFIX = "$"


def _annotations(node: Node) -> list:
    return [{"name": a.name, "args": a.args, "properties": dict(a.properties)}
            for a in node.annotations]


def _wrap(node: Node, projected: Any) -> Any:
    """Bare value when the node carries no metadata, wrapper object otherwise."""
    if node.confidence is None and not node.annotations:
        return projected
    out: dict = {"$value": projected}
    if node.confidence is not None:
        out["$confidence"] = node.confidence
    if node.annotations:
        out["$annotations"] = _annotations(node)
    return out


def _value(v: Any) -> Any:
    if isinstance(v, Synthesize):
        # an object, never a bare string, so it cannot be mistaken for data (§4.4)
        return {"$synthesize": v.description}
    if isinstance(v, dict):
        return _obj(v)
    if isinstance(v, list):
        return [_node(n) if isinstance(n, Node) else _value(n) for n in v]
    return v


def _node(node: Node) -> Any:
    return _wrap(node, _value(node.value))


def _obj(d: dict) -> dict:
    out: dict = {}
    for key, node in d.items():
        # §6 reserves $-prefixed keys so a document key can never collide with
        # the wrapper members.
        if key.startswith(RESERVED_PREFIX):
            raise CsonError(f"Key {key!r} uses the reserved '$' prefix", 0, 0)
        out[key] = _node(node) if isinstance(node, Node) else _value(node)
    return out


def project(root: dict) -> dict:
    """The SPEC §6 projection."""
    return _obj(root)


def project_values(root: dict) -> dict:
    """Value-only projection: drops all metadata.

    Not the spec projection -- a convenience for callers that want plain data
    and have no use for confidence or annotations. It is lossy by construction.
    """
    def val(v: Any) -> Any:
        if isinstance(v, Synthesize):
            return {"$synthesize": v.description}
        if isinstance(v, dict):
            return {k: val(n.value) if isinstance(n, Node) else val(n) for k, n in v.items()}
        if isinstance(v, list):
            return [val(n.value) if isinstance(n, Node) else val(n) for n in v]
        return v
    return val(root)
