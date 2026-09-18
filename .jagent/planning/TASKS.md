# TASKS — cson

Every open item below represents a planned task or issue. See
`.jagent/planning/tickets/` for full detail on each `CSON-N` ID.

---

## P1 — extraction follow-through

- [x] Extract the parser from `crush-ast/crush-cson` (language-agnostic parts);
  `SPEC.md` + `conformance/` written; builds zero-crush.
- [ ] **CSON-1** — `to_json` should emit the full SPEC §6 projection
  (`$confidence` / `$annotations` sibling keys), not just values + `$synthesize`.
- [ ] **CSON-3** — publish `cson` to crates.io; then make `crush-cson` a thin
  wrapper (`cson` + `CsonParseCap`). Needs a crush-ast PR.
- [ ] **CSON-4** — re-point crush-ast's 5 dependents (`crush-cast`, `crush-index`,
  `crush-lang-custom`, `crush-lang-sdk`, `crush-python`) to the `cson` dep.

## P2 — conformance + reach

- [ ] **CSON-2** — full conformance vector set covering every grammar
  production + edge cases; document the per-language runner contract.
- [ ] **CSON-5** — a second-language parser as proof the spec travels.
- [ ] **CSON-6** — print → parse round-trip corpus.

## Non-goals

Grammar changes without a version bump; anything CrusH-runtime (stays in crush-ast).

Map of prior work: `ROADMAP.md`.
