# CSON-8 — Go parser

| Field | Value |
|-------|-------|
| **ID** | CSON-8 |
| **Priority** | P3 |
| **Status** | Backlog |
| **Phase** | M1 — multi-language parsers on a settled spec |
| **Assignee** | unassigned |
| **Dependencies** | none (CSON-1 settled the contract) |
| **Estimated effort** | M |

## Problem

Single-binary tooling (`cson fmt`, `cson validate`, a pre-commit hook) wants a parser
that does not drag a language runtime along. Go is the natural fit, and a third
independent implementation is a much stronger test of whether the spec is complete than
a second one.

## Success criteria

- [ ] Passes all 11 valid + 5 invalid conformance vectors
- [ ] Produces projections **byte-identical** to the Rust and Python implementations
- [ ] Zero runtime dependencies
- [ ] Idiomatic Go types for `Node` / `Annotation` / `Synthesize` / `Document`
- [ ] `go test ./...` runs the corpus with no external deps

## Technical approach

- Mirror `impl/python/`'s structure: parse to a node model that **preserves** confidence
  and annotations, then project per SPEC §6. Do not project during parsing.
- Hand-written recursive descent over a cursor; no parser-generator dependency.
- Port the two test suites: the corpus runner and the spec-behaviour checks.
- Validate against a real (large) CSON document as well as the corpus — the 13 vectors
  do not exercise content-addressed keys, stacked annotations or long escaped strings.

## Files to modify

- `impl/go/` — parser, model, projection
- `impl/go/conformance_test.go` — corpus runner + spec checks
- `impl/go/go.mod` — stdlib only

## Non-goals

- A printer (that is CSON-9)
- A CLI binary — separate ticket if wanted, once the parser exists
- Fuzzy matching of semantic keys — parse and flag them; matching is a consumer concern

## Traps (from `.dejavue/`)

- **Absent confidence is not `1.0`** (§4.2). A parser that collapses them still passed
  every vector until `confidence_absent_vs_one` was added.
- **An array element is a node** (§5) and may carry confidence and annotations. The Rust
  parser got this wrong.
- **`@cson` is document metadata** (§2.5), not an annotation on the following node. The
  Rust parser got this wrong too.
