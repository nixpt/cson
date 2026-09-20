# cson — JavaScript / TypeScript parser

A dependency-free implementation of [CSON](../../SPEC.md) for JS and TS. No build
step, no platform APIs in the parser — it runs unchanged in Node and a browser.

```js
import { parse, loads } from "./src/index.mjs";

const doc = parse('temperature: 21.5 ~0.8 @source { by: "sensor-3" }');
const node = doc.root.get("temperature");
node.value;         // 21.5
node.confidence;    // 0.8   (null when unstated — see below)
node.annotations;   // [ Annotation { name: "source", args: null, properties: { by: "sensor-3" } } ]

loads('tags: ["a", "b"]');   // { tags: ["a", "b"] }
```

TypeScript types ship hand-written in `src/index.d.ts` — there is no compile step.

## Objects are `Map`s

The node model uses `Map` rather than a plain object, so key order survives and a
document key can never collide with `Object.prototype`. The §6 projection returns
plain objects, as JSON consumers expect.

## Absent confidence is not 1.0

SPEC §4.2: an absent confidence means *no claim*, which is not the same as claiming
certainty. Both the model and the projection keep them distinct:

```js
loads("a: 1\nb: 1 ~1.0");
// { a: 1, b: { $value: 1, $confidence: 1 } }
```

## Errors

Every rejection is a `CsonError` carrying `line` and `col` (SPEC §7):

```js
try { parse("a: 1\na: 2"); }
catch (e) { e.reason; e.line; e.col; }   // "Duplicate key \"a\"", 2, 1
```

## Tests

```bash
npm test          # all three suites
```

- `test/conformance.mjs` — the language-neutral corpus, the contract (SPEC §8)
- `test/spec.mjs` — spec behaviour the corpus does not pin down
- `test/cross-check.mjs` — asserts **Rust, Python and JS project identically**

That last one is the important one. "Each implementation passes its own tests" is
weaker than "all implementations agree", and agreement is what the corpus is for.

**Numbers:** SPEC §2.3 makes all numbers IEEE-754 doubles, but languages *render*
them differently — Python emits `8080.0`, JS emits `8080`. The cross-check normalises
numbers before comparing; a naive string diff reports false divergence on 6 of 11
vectors.

## Status

16/16 conformance vectors, 36/36 spec checks, and identical projections to the Rust
reference and the Python implementation on every vector.
