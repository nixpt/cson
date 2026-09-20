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
- [ ] **CSON-6** — print → parse round-trip corpus. Blocked on CSON-9 (no printer yet).

## P3 — more languages, now that the contract is settled

- [ ] **CSON-7** — JavaScript/TypeScript parser under `impl/js/`.
- [ ] **CSON-8** — Go parser under `impl/go/`.
- [ ] **CSON-9** — a CSON printer. Every implementation parses only today, so §6's
  "reconstructable from its projection plus the printer" is unverifiable.
- [ ] **CSON-10** — CI running *every* implementation against the corpus on one
  checkout, so a parser cannot silently drift.

## Non-goals

Grammar changes without a version bump; anything CrusH-runtime (stays in crush-ast).
Vendoring corpora built with CSON — the format is public, the data may not be.

Map of prior work: `ROADMAP.md`. Durable reasoning: `.dejavue/`.
