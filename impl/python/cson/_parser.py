"""CSON parser — a direct implementation of SPEC.md §2-§5.

Hand-written recursive descent over a character cursor. No dependencies.
"""
from __future__ import annotations

from typing import Any, Optional

from ._model import Annotation, CsonError, Document, Node, Synthesize

_BOOL = {"true": True, "false": False}


class _Cursor:
    __slots__ = ("s", "i", "n")

    def __init__(self, s: str):
        self.s, self.i, self.n = s, 0, len(s)

    # position is derived, not tracked, so the cursor stays cheap to rewind
    def pos(self, at: Optional[int] = None) -> tuple:
        at = self.i if at is None else at
        line = self.s.count("\n", 0, at) + 1
        nl = self.s.rfind("\n", 0, at)
        return line, at - nl

    def err(self, msg: str, at: Optional[int] = None) -> CsonError:
        return CsonError(msg, *self.pos(at))

    def eof(self) -> bool:
        return self.i >= self.n

    def peek(self) -> str:
        return self.s[self.i] if self.i < self.n else ""

    def skip_ws(self, newlines: bool = True) -> None:
        """Whitespace is insignificant except in strings; comments run # -> EOL
        and may appear anywhere whitespace may (SPEC §2.1)."""
        while self.i < self.n:
            c = self.s[self.i]
            if c == "#":
                j = self.s.find("\n", self.i)
                self.i = self.n if j < 0 else j
            elif c == "\n":
                if not newlines:
                    return
                self.i += 1
            elif c in " \t\r":
                self.i += 1
            else:
                return


def _parse_string(c: _Cursor) -> str:
    start = c.i
    if c.peek() != '"':
        raise c.err("Expected a string")
    c.i += 1
    out = []
    while True:
        if c.eof():
            raise c.err("Unclosed string", start)
        ch = c.s[c.i]
        if ch == '"':
            c.i += 1
            return "".join(out)
        if ch == "\\":
            c.i += 1
            if c.eof():
                raise c.err("Unclosed string", start)
            e = c.s[c.i]
            out.append({"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f",
                        '"': '"', "\\": "\\", "/": "/"}.get(e, e))
            if e == "u":
                hexs = c.s[c.i + 1:c.i + 5]
                if len(hexs) < 4:
                    raise c.err("Truncated \\u escape")
                out[-1] = chr(int(hexs, 16))
                c.i += 4
            c.i += 1
        else:
            out.append(ch)
            c.i += 1


def _parse_number(c: _Cursor) -> float:
    start = c.i
    if c.peek() in "+-":
        c.i += 1
    while c.i < c.n and (c.s[c.i].isdigit() or c.s[c.i] in ".eE+-"):
        # stop at an exponent sign that is not part of the number
        if c.s[c.i] in "+-" and c.s[c.i - 1] not in "eE":
            break
        c.i += 1
    text = c.s[start:c.i]
    try:
        # SPEC §2.3: all numbers are IEEE-754 doubles
        return float(text)
    except ValueError:
        raise c.err(f"Invalid number {text!r}", start) from None


def _parse_annotation(c: _Cursor) -> Annotation:
    start = c.i
    c.i += 1                                    # '@'
    j = c.i
    while c.i < c.n and (c.s[c.i].isalnum() or c.s[c.i] in "_-"):
        c.i += 1
    name = c.s[j:c.i]
    if not name:
        raise c.err("Annotation needs a name", start)

    args = None
    save = c.i
    c.skip_ws(newlines=False)
    if c.peek() == "(":
        open_at = c.i
        c.i += 1
        k = c.s.find(")", c.i)
        if k < 0:
            raise c.err("Unclosed annotation arguments", open_at)
        args = c.s[c.i:k].strip().strip('"')
        c.i = k + 1
    else:
        c.i = save

    props: dict = {}
    save = c.i
    c.skip_ws(newlines=False)
    if c.peek() == "{":
        open_at = c.i
        c.i += 1
        while True:
            c.skip_ws()
            if c.eof():
                raise c.err("Unclosed annotation properties", open_at)
            if c.peek() == "}":
                c.i += 1
                break
            k = c.i
            while c.i < c.n and c.s[c.i] not in ":,}":
                c.i += 1
            pname = c.s[k:c.i].strip()
            if c.peek() != ":":
                raise c.err("Malformed annotation property: expected a colon", k)
            c.i += 1
            c.skip_ws()
            props[pname] = _parse_string(c) if c.peek() == '"' else _parse_bare_prop(c)
            c.skip_ws()
            if c.peek() == ",":
                c.i += 1                        # trailing comma permitted (§5)
    else:
        c.i = save
    return Annotation(name, args, props)


def _parse_bare_prop(c: _Cursor) -> str:
    k = c.i
    while c.i < c.n and c.s[c.i] not in ",}\n":
        c.i += 1
    return c.s[k:c.i].strip()


def _parse_value(c: _Cursor) -> Any:
    c.skip_ws()
    ch = c.peek()
    if ch == "":
        raise c.err("Expected a value")
    if ch == '"':
        return _parse_string(c)
    if ch == "{":
        return _parse_object(c)
    if ch == "[":
        return _parse_array(c)
    if ch == "@":
        at = c.i
        if c.s.startswith("@synthesize", c.i):
            c.i += len("@synthesize")
            c.skip_ws()
            if c.peek() != "(":
                raise c.err("@synthesize needs a parenthesised description", at)
            c.i += 1
            c.skip_ws()
            desc = _parse_string(c)
            c.skip_ws()
            if c.peek() != ")":
                raise c.err("Unclosed @synthesize", at)
            c.i += 1
            return Synthesize(desc)
        raise c.err("Unexpected annotation where a value was expected", at)
    for word, val in (("true", True), ("false", False), ("null", None)):
        if c.s.startswith(word, c.i):
            nxt = c.s[c.i + len(word):c.i + len(word) + 1]
            if not (nxt.isalnum() or nxt == "_"):
                c.i += len(word)
                return val
    if ch.isdigit() or ch in "+-.":
        return _parse_number(c)
    raise c.err(f"Unexpected character {ch!r} where a value was expected")


def _parse_node(c: _Cursor, pending: list) -> Node:
    """node := value (ws '~' number)? (ws annotation)*   -- SPEC §3"""
    value = _parse_value(c)
    conf: Optional[float] = None
    anns = list(pending)

    while True:
        save = c.i
        c.skip_ws(newlines=False)
        if c.peek() == "~" and conf is None:
            at = c.i
            c.i += 1
            c.skip_ws(newlines=False)
            conf = _parse_number(c)
            if not (0.0 <= conf <= 1.0):
                raise c.err(f"Confidence {conf} outside [0.0, 1.0]", at)
            continue
        if c.peek() == "@":
            anns.append(_parse_annotation(c))
            continue
        c.i = save
        break
    return Node(value, conf, tuple(anns))


def _parse_object(c: _Cursor) -> dict:
    open_at = c.i
    c.i += 1                                    # '{'
    out: dict = {}
    while True:
        c.skip_ws()
        if c.eof():
            raise c.err("Unclosed object", open_at)
        if c.peek() == "}":
            c.i += 1
            return out
        key, semantic = _parse_key(c)
        if key in out:
            raise c.err(f"Duplicate key {key!r}")
        node = _parse_node(c, [])
        node.semantic = semantic
        out[key] = node
        c.skip_ws()
        if c.peek() == ",":
            c.i += 1                            # trailing comma permitted
        elif c.peek() not in ("}", ""):
            continue


def _parse_array(c: _Cursor) -> list:
    open_at = c.i
    c.i += 1                                    # '['
    out = []
    while True:
        c.skip_ws()
        if c.eof():
            raise c.err("Unclosed array", open_at)
        if c.peek() == "]":
            c.i += 1
            return out
        out.append(_parse_node(c, []))
        c.skip_ws()
        if c.peek() == ",":
            c.i += 1


def _parse_key(c: _Cursor) -> tuple:
    """key := semantic_key | quoted_key | bare_key   -- SPEC §2.2"""
    c.skip_ws()
    semantic = False
    if c.peek() == "~":
        save = c.i
        c.i += 1
        c.skip_ws(newlines=False)
        if c.peek() != '"':
            c.i = save
            raise c.err("A semantic key must be ~ followed by a quoted string")
        key, semantic = _parse_string(c), True
    elif c.peek() == '"':
        key = _parse_string(c)
    else:
        start = c.i
        while c.i < c.n and c.s[c.i] not in ":\n":
            c.i += 1
        key = c.s[start:c.i].strip()
        if not key:
            raise c.err("Expected a key", start)
    c.skip_ws(newlines=False)
    if c.peek() != ":":
        raise c.err(f"Key {key!r} must be followed by a colon")
    c.i += 1
    return key, semantic


def parse(text: str) -> Document:
    """Parse a CSON document. Raises CsonError with position on failure."""
    c = _Cursor(text)
    root: dict = {}
    version = "1.0"
    pending: list = []
    section: Optional[dict] = None

    while True:
        c.skip_ws()
        if c.eof():
            break
        ch = c.peek()

        if ch == "[":                            # section (§2.4)
            open_at = c.i
            c.i += 1
            j = c.s.find("]", c.i)
            nl = c.s.find("\n", c.i)
            if j < 0 or (nl >= 0 and nl < j):
                raise c.err("Unclosed section", open_at)
            name = c.s[c.i:j].strip()
            c.i = j + 1
            section = {}
            if name in root:
                raise c.err(f"Duplicate key {name!r}", open_at)
            root[name] = Node(section)
            continue

        if ch == "@":
            ann = _parse_annotation(c)
            if ann.name == "cson":               # reserved for doc metadata (§2.5)
                version = ann.properties.get("version") or ann.args or version
            else:
                pending.append(ann)              # attaches to the NEXT node (§4.3)
            continue

        key, semantic = _parse_key(c)
        target = section if section is not None else root
        if key in target:
            raise c.err(f"Duplicate key {key!r}")
        node = _parse_node(c, pending)
        node.semantic = semantic
        pending = []
        target[key] = node

    return Document(root, version)
