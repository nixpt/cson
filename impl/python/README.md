# cson — Python parser

A dependency-free Python implementation of [CSON](../../SPEC.md) (Crush Semantic
Object Notation): JSON's shape plus four AI-native primitives — semantic keys,
confidence, annotations, and synthesized values.

```python
import cson

doc = cson.parse('temperature: 21.5 ~0.8 @source { by: "sensor-3" }')
node = doc.root["temperature"]
node.value          # 21.5
node.confidence     # 0.8   (None when unstated -- see below)
node.annotations    # (Annotation(name='source', args=None, properties={'by': 'sensor-3'}),)

cson.loads('tags: ["a", "b"]')          # {'tags': ['a', 'b']}  -- plain JSON data
```

## Two projections, deliberately

`loads()` / `project()` give the **value-only** JSON projection, which is what the
[conformance corpus](../../conformance/) requires today.

`project_full()` implements the SPEC §6 **target** shape, with `"<key>$confidence"`
and `"<key>$annotations"` sibling keys:

```python
cson.project_full(cson.parse('t: 21.5 ~0.8').root)
# {'t': 21.5, 't$confidence': 0.8}
```

The spec flags that gap as a tracked conformance item, and the Rust reference has
not closed it either — so this implementation ships both rather than guessing which
one callers need.

## Absent confidence is not 1.0

SPEC §4.2 is explicit: an absent confidence means *no claim*, which is not the same
as claiming certainty. The parser keeps them distinguishable and callers should too:

```python
d = cson.parse('a: 1\nb: 1 ~1.0')
d.root["a"].confidence is None    # True  -- unstated
d.root["b"].confidence == 1.0     # True  -- explicitly certain
```

The value-only projection drops confidence entirely, so use `parse()` (not `loads()`)
whenever the metadata matters.

## Errors

Every rejection is a `CsonError` carrying `line` and `col` (SPEC §7):

```python
try:
    cson.parse("a: 1\na: 2")
except cson.CsonError as e:
    e.message, e.line, e.col      # ("Duplicate key 'a'", 2, 1)
```

## Tests

```bash
python3 tests/test_conformance.py   # the language-neutral corpus -- the contract
python3 tests/test_spec.py          # spec behaviour the corpus does not pin down
```

Both are dependency-free and exit non-zero on failure.

## Status

Passes all 13 conformance vectors and 34 spec checks. Validated against a real
156 MB CSON corpus (content-addressed keys, stacked annotations with args and
properties) at ~10 MB/s.
