"""JSON projection — SPEC.md §6.

NOTE on scope: the conformance corpus as it stands projects a node's VALUE only;
confidence and annotations are dropped (e.g. `temperature: 21.5 ~0.8` projects to
{"temperature": 21.5}). SPEC §6 describes `"<key>$confidence"` / `"<key>$annotations"`
sibling keys as the specified target and explicitly tracks that gap as a conformance
item, which the Rust reference has not closed either.

So `project()` matches the corpus (the contract), and `project_full()` implements the
§6 target shape. The node model always PRESERVES confidence and annotations regardless
-- §4.2 requires absent to stay distinguishable from 1.0.
"""
from __future__ import annotations

from typing import Any

from ._model import Node, Synthesize


def _value(v: Any, full: bool) -> Any:
    if isinstance(v, Synthesize):
        # an object, never a bare string, so it cannot be mistaken for data (§4.4/§6)
        return {"$synthesize": v.description}
    if isinstance(v, dict):
        return _obj(v, full)
    if isinstance(v, list):
        return [_value(n.value, full) if isinstance(n, Node) else _value(n, full) for n in v]
    return v


def _obj(d: dict, full: bool) -> dict:
    out: dict = {}
    for key, node in d.items():
        if not isinstance(node, Node):
            out[key] = _value(node, full)
            continue
        out[key] = _value(node.value, full)
        if full:
            if node.confidence is not None:
                out[f"{key}$confidence"] = node.confidence
            if node.annotations:
                out[f"{key}$annotations"] = [
                    {"name": a.name, "args": a.args, "properties": dict(a.properties)}
                    for a in node.annotations
                ]
    return out


def project(root: dict) -> dict:
    """Value-only projection — matches the conformance corpus."""
    return _obj(root, full=False)


def project_full(root: dict) -> dict:
    """SPEC §6 target projection, with $confidence / $annotations siblings."""
    return _obj(root, full=True)
