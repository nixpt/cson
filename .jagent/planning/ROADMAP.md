# ROADMAP — cson

North star: **CSON is a format anyone can adopt** — a spec with a conformance
corpus and a reference parser per language, the way JSON works. This repo is the
spec's home plus the Rust reference implementation.

## Now (v0.1 — extraction)

- [x] Rust reference parser (extracted from `crush-ast/crush-cson`, verbatim)
- [x] `SPEC.md` — grammar, primitives, JSON projection, errors (§1–9)
- [x] `conformance/` — valid + invalid vectors, Rust runner
- [x] Zero crush coupling; `serde`/`serde_json` only

## v0.2 — the spec is settled and travels (2026-09-20)

- [x] CSON-1 — SPEC §6 projection settled. The `$confidence`/`$annotations`
  sibling-key form this item assumed was **rejected**: it cannot express metadata on
  an array element, it collides with a literal `t$confidence` key, and §6 contradicted
  its own reconstructability claim. Replaced by one wrapper rule —
  `{"$value":…,"$confidence":…,"$annotations":[…]}`. See `.dejavue/decisions.md`.
- [x] CSON-5 — second-language parser: `impl/python/`, dependency-free.
  It did its job twice over — proving the spec travels, *and* exposing two bugs in the
  Rust reference that the old projection had been hiding.

## Next

- [ ] CSON-7 — JavaScript/TypeScript parser (`impl/js/`) — the reach lever
- [ ] CSON-8 — Go parser (`impl/go/`) — single-binary tooling; a third independent
  implementation tests spec completeness far harder than a second
- [ ] CSON-2 — grow `conformance/` into a full vector set (every grammar
  production; fuzz-found edges) with a documented per-language runner contract
- [ ] CSON-10 — CI running every implementation against the corpus on one checkout

## Later

- [ ] CSON-9 — a CSON printer; §6 claims a document is reconstructable from its
  projection plus the printer, and nothing verifies that because there is no printer
- [ ] CSON-6 — print → parse round-trip corpus (blocked on CSON-9)
- [ ] CSON-3 — publish `cson` to crates.io; revisit `crush-cson`'s fate. Note it is
  **crush's own parser for crush**, not a stale fork to reconcile — the thin-wrapper
  framing may no longer be the right one
- [ ] CSON-4 — wire `crush-ast`'s 5 dependents to the `cson` dep

## Non-goals

- Not the Crush runtime: the `cson.parse` VM host capability lives in `crush-ast`.
- No grammar changes without a spec-version bump (SPEC §9).
