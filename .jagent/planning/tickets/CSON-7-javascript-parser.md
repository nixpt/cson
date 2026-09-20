# CSON-7 — JavaScript/TypeScript parser

| Field | Value |
|-------|-------|
| **ID** | CSON-7 |
| **Priority** | P3 |
| **Status** | Backlog |
| **Phase** | M1 — multi-language parsers on a settled spec |
| **Assignee** | unassigned |
| **Dependencies** | none (CSON-1 settled the contract) |
| **Estimated effort** | M |

## Problem

CSON is positioned as "JSON for agents", and JSON's reach comes from having a parser
everywhere. Today there are two implementations (Rust, Python) and neither runs in a
browser, an editor extension, or a Node tool.

## Success criteria

- [ ] Passes all 11 valid + 5 invalid conformance vectors
- [ ] Produces projections **byte-identical** to the Rust and Python implementations
- [ ] Zero runtime dependencies
- [ ] TypeScript types for `Node` / `Annotation` / `Synthesize` / `Document`
- [ ] Runs in Node and in a browser (no `fs` in the parser itself)

## Technical approach

- Mirror `impl/python/`'s structure: parse to a node model that **preserves** confidence
  and annotations, then project per SPEC §6. Do not project during parsing.
- Hand-written recursive descent over a cursor; no parser-generator dependency.
- Port the two test suites: the corpus runner and the spec-behaviour checks.
- Validate against a real (large) CSON document as well as the corpus — the 13 vectors
  do not exercise content-addressed keys, stacked annotations or long escaped strings.

## Files to modify

- `impl/js/src/` — parser, model, projection
- `impl/js/test/` — corpus runner + spec checks
- `impl/js/package.json` — no `dependencies`

## Non-goals

- A printer (that is CSON-9)
- Fuzzy matching of semantic keys — parse and flag them; matching is a consumer concern

## Traps (from `.dejavue/`)

- **Absent confidence is not `1.0`** (§4.2). A parser that collapses them still passed
  every vector until `confidence_absent_vs_one` was added.
- **An array element is a node** (§5) and may carry confidence and annotations. The Rust
  parser got this wrong.
- **`@cson` is document metadata** (§2.5), not an annotation on the following node. The
  Rust parser got this wrong too.
