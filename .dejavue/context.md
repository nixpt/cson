---
name: cson
purpose: The standalone home of CSON (Crush Semantic Object Notation) — the format spec, its conformance corpus, and a reference parser per language.
dcp: DCP/1.0
---

# Context

<!-- The DCP instruction layer: what an agent should *do* in this repo.
     Source of truth — adapters (CLAUDE.md / AGENTS.md / …) are generated
     from this file via `dejavue export --target <tool>`. -->

## What this repo is

CSON is a JSON-shaped configuration/serialization format with four primitives JSON
lacks: **semantic keys** (`~"intent": v`), **confidence** (`v ~0.95`), **annotations**
(`@name(args) { k: "v" }`) and **synthesized values** (`@synthesize("…")`).

`SPEC.md` is the format. `conformance/` is the contract. `src/` is the Rust reference
parser. `impl/<lang>/` holds parsers for other languages.

The format is public. Corpora built *with* it (e.g. training data) are not part of this
repo and may be private — do not vendor corpus data here.

## Operating Rules

- **The corpus is the contract (SPEC §8).** An implementation is conforming iff it
  passes every vector. Never let a parser diverge from `conformance/`.
- **A spec change touches three things in one commit:** `SPEC.md`, the vectors, and
  *every* implementation. Grammar/primitive changes bump the format version (§9); a
  projection or wording fix does not.
- **When you add a spec rule, add a vector that fails without it.** The corpus has
  already been wrong this way once — it dropped confidence from the projection, so a
  parser violating §4.2 passed every vector. See `.dejavue/decisions.md`.
- **Settle spec ambiguity before adding implementations.** Each new parser multiplies
  the cost of an unsettled question.
- Validate against a real document as well as the corpus; the vectors are small and
  do not exercise content-addressed keys, stacked annotations or large escaped strings.

## Build / Test

```bash
cargo test                             # Rust reference + conformance corpus
python3 impl/python/tests/test_conformance.py   # the corpus, from Python
python3 impl/python/tests/test_spec.py          # spec behaviour the corpus does not pin down
```

All suites are dependency-free and exit non-zero on failure. Both implementations must
produce **identical** projections for every vector.

## Layout

```
SPEC.md                  the format (language-agnostic)
conformance/valid/       <name>.cson + <name>.expected.json  (MUST parse + project)
conformance/invalid/     <name>.cson + <name>.error          (MUST be rejected)
src/                     Rust reference parser; src/project.rs is the SPEC §6 projection
impl/python/             Python parser (dependency-free)
```

## Gotchas worth knowing before you touch the parser

- `@cson` is **document metadata** (§2.5), not an annotation on the next node.
- An **array element is a node** (§5) — it may carry confidence and annotations.
- **Absent confidence is not `1.0`** (§4.2). Keep them distinguishable everywhere.
- `CsonDocument::to_json()` is serde serialization of the node model, **not** the §6
  projection. Use `CsonDocument::project()` for §6.
