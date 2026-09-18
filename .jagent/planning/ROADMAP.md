# ROADMAP — cson

North star: **CSON is a format anyone can adopt** — a spec with a conformance
corpus and a reference parser per language, the way JSON works. This repo is the
spec's home plus the Rust reference implementation.

## Now (v0.1 — extraction)

- [x] Rust reference parser (extracted from `crush-ast/crush-cson`, verbatim)
- [x] `SPEC.md` — grammar, primitives, JSON projection, errors (§1–9)
- [x] `conformance/` — valid + invalid vectors, Rust runner
- [x] Zero crush coupling; `serde`/`serde_json` only

## Next

- [ ] CSON-1 — settle the `$confidence` / `$annotations` JSON projection in
  `to_json` to match SPEC §6 (currently values + `$synthesize` only)
- [ ] CSON-2 — grow `conformance/` into a full vector set (every grammar
  production; fuzz-found edges) with a documented per-language runner contract
- [ ] CSON-3 — publish `cson` to crates.io; decide `crush-cson`'s fate (thin
  wrapper re-exporting `cson` + `CsonParseCap`) — needs crush-ast PR
- [ ] CSON-4 — wire `crush-ast`'s 5 dependents to the `cson` dep

## Later

- [ ] CSON-5 — a second-language parser (`cson-py`?) as proof the spec travels
- [ ] CSON-6 — a CSON pretty-printer/round-trip corpus (print → parse identity)

## Non-goals

- Not the Crush runtime: the `cson.parse` VM host capability lives in `crush-ast`.
- No grammar changes without a spec-version bump (SPEC §9).
