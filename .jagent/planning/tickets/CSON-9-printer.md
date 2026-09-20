# CSON-9 — CSON printer

| Field | Value |
|-------|-------|
| **ID** | CSON-9 |
| **Priority** | P3 |
| **Status** | Backlog |
| **Phase** | M1 — multi-language parsers on a settled spec |
| **Assignee** | unassigned |
| **Dependencies** | none |
| **Estimated effort** | M |

## Problem

Every implementation parses only. SPEC §6 states a document "can be reconstructed from
its projection plus the CSON printer" — a claim nothing currently verifies, because the
printer does not exist. CSON-6 (round-trip corpus) is blocked on this.

## Success criteria

- [ ] `print(document) -> String` emitting valid CSON for every corpus vector
- [ ] `parse(print(doc)) == doc` at the node level (value, confidence, annotations,
      semantic-key flag) for all vectors
- [ ] Confidence is emitted only when stated — an absent confidence must not become
      `~1.0` (§4.2)
- [ ] Reserved `$`-prefixed keys are rejected rather than silently emitted

## Technical approach

- Print from the **node model**, not from the JSON projection — the projection is lossy
  in syntax (comments, section sugar, key order) by design.
- Decide and document what is *not* preserved: comments, `[section]` sugar vs nested
  objects, key order, bare-vs-quoted key choice. Round-trip is at the node level, not
  the byte level.
- Implement in Rust first (reference), then mirror in each `impl/`.

## Files to modify

- `src/print.rs` + export from `src/lib.rs`
- `impl/<lang>/` — mirror once the Rust shape is settled
- `conformance/README.md` — document the round-trip contract

## Non-goals

- Byte-identical round-trip. Syntax is explicitly not preserved (§6).
- A formatter with style options — that is a CLI concern, not the library's.
