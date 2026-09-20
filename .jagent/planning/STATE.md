# Planning state — cson

**Updated:** 2026-09-20
**Milestone focus:** M1 — multi-language parsers on a settled spec
**Branch:** `main` @ `8b86e83`

## Where the format stands

Format **v1.0 draft, grammar stable.** SPEC §6 (the JSON projection) was the last
open design question and is now settled (`381bad3`): a node with no metadata projects
to its bare value; a node carrying confidence or annotations projects to a wrapper
object `{"$value":…,"$confidence":…,"$annotations":[…]}`.

That decision, its rejected alternatives, and the reasoning are in
`.dejavue/decisions.md`. Do not re-litigate it without reading that first.

## Implementations

| language | location | status |
|---|---|---|
| Rust (reference) | `src/` | 13/13 tests, projection in `src/project.rs` |
| Python | `impl/python/` | 16/16 conformance + 38/38 spec checks, dependency-free |

Both produce **identical projections for every vector**. That property is the point of
the corpus and must hold for every implementation added.

## Conformance corpus

11 valid + 5 invalid vectors. Three were added when §6 was settled:
`confidence_absent_vs_one` (pins §4.2 — before it, a parser collapsing absent
confidence to `1.0` passed *every* vector), `array_metadata`, `nested_metadata`.

## What settling §6 immediately caught

Two real bugs in the Rust reference, both invisible while the old projection discarded
the evidence: `@cson` attaching itself to the following node instead of setting the
document version (§2.5), and array elements dropping trailing annotations. Recorded as
traps in `.dejavue/`.

## Open

See `.jagent/planning/TASKS.md`. Next up is a JS/TypeScript parser, built against the
settled contract.
