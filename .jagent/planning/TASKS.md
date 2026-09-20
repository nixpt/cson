# TASKS — cson

Every open item below represents a planned task or issue. See
`.jagent/planning/tickets/` for full detail on each `CSON-N` ID.

---

## P1 — extraction follow-through

- [x] Extract the parser from `crush-ast/crush-cson` (language-agnostic parts);
  `SPEC.md` + `conformance/` written; builds zero-crush.
- [x] **CSON-1** — SPEC §6 projection settled and implemented (`381bad3`).
  **Settled differently from how this ticket framed it:** the sibling-key form
  (`"<key>$confidence"`) was *rejected* — it cannot express metadata on an array
  element, it collides with a literal `t$confidence` key, and §6 contradicted itself
  by claiming reconstructability while the corpus enforced a lossy shape. The rule is
  now a wrapper object. Reasoning + rejected alternatives: `.dejavue/decisions.md`.
  Also moved the projection out of `tests/conformance.rs` into `src/project.rs`.
- [ ] **CSON-3** — publish `cson` to crates.io; then make `crush-cson` a thin
  wrapper (`cson` + `CsonParseCap`). Needs a crush-ast PR.
  **Note:** `crush-ast/crates/crush-cson` is crush's own parser for crush, not a stale
  fork to reconcile — revisit whether the thin-wrapper framing still holds.
- [ ] **CSON-4** — re-point crush-ast's 5 dependents (`crush-cast`, `crush-index`,
  `crush-lang-custom`, `crush-lang-sdk`, `crush-python`) to the `cson` dep.

## P2 — conformance + reach

- [ ] **CSON-2** — full conformance vector set covering every grammar
  production + edge cases; document the per-language runner contract.
  *Advanced:* +3 vectors (`confidence_absent_vs_one`, `array_metadata`,
  `nested_metadata`); corpus now 11 valid + 5 invalid. Still wants full production
  coverage and fuzz-found edges.
- [x] **CSON-5** — a second-language parser as proof the spec travels.
  Python landed at `impl/python/` (dependency-free, 16/16 conformance + 38/38 spec
  checks). It proved the spec travels *and* found two reference-parser bugs.
- [x] **CSON-6** — round-trip verified, and cross-language: the cross-check now has
  the Rust printer emit each vector, then asserts ALL FOUR implementations parse the
  printed form to the same meaning. Not a separate corpus of printed files — the
  property is checked against the existing vectors, so it cannot drift from them.

## P3 — more languages, now that the contract is settled

- [x] **CSON-7** — JavaScript/TypeScript parser: `impl/js/`, dependency-free, no build
  step, hand-written `.d.ts`. 16/16 conformance + 36/36 spec checks. Also added
  `test/cross-check.mjs`, which asserts all three implementations project identically.
- [x] **CSON-8** — Go parser: `impl/go/`, stdlib only. 16/16 conformance + 14 spec
  tests (30 subtests). `Confidence *float64` so absent stays distinguishable from
  `~1.0`; `*Object` preserves key order for a future printer.
- [x] **CSON-9** — CSON printer in the Rust reference (`src/print.rs`), making §6's
  reconstructability claim checkable. Round-trip is at the NODE level: comments,
  `[section]` sugar, key order and bare-vs-quoted choice are deliberately not
  preserved; values, confidence, annotations, semantic keys and version are.
  Printers for the other implementations remain open (see CSON-11).
- [x] **CSON-10** — `.github/workflows/conformance.yml`: a job per implementation
  plus a `cross-check` job asserting all four project identically.
  `CSON_CROSSCHECK_REQUIRE` makes a missing toolchain a hard failure instead of a
  silently narrower comparison.

- [ ] **CSON-11** — printers for Python, JavaScript and Go. Rust has one; the others
  parse only. Needed before any of them can emit CSON rather than just consume it.

## Non-goals

Grammar changes without a version bump; anything CrusH-runtime (stays in crush-ast).
Vendoring corpora built with CSON — the format is public, the data may not be.

Map of prior work: `ROADMAP.md`. Durable reasoning: `.dejavue/`.
