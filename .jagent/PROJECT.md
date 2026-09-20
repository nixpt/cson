# cson

CSON — **Crush Semantic Object Notation**: a JSON-shaped configuration and
serialization format with four primitives JSON lacks — semantic keys
(`~"intent": v`), confidence (`v ~0.95`), annotations (`@name(args) { k: "v" }`)
and synthesized values (`@synthesize("…")`).

## Identity

- **Repository:** cson (public)
- **Language:** Rust (reference parser) + one implementation per language under `impl/`
- **Protocol:** library. No CLI or daemon yet — a `cson fmt` / `cson validate` binary is
  a candidate, not a commitment.
- **Spec:** `SPEC.md` is the format and is language-agnostic. `conformance/` is the contract.

## The one rule that governs everything here

**The conformance corpus is the contract (SPEC §8).** An implementation is conforming
iff it passes every vector. A spec change touches `SPEC.md`, the vectors, and *every*
implementation in the same commit — parsers must never diverge from the corpus.

## Boundaries

- The **format is public**. Corpora built *with* CSON (e.g. training data) are separate
  and may be private — never vendor corpus data into this repo.
- `crush-ast/crates/crush-cson` is **crush's own parser for crush**, not a fork of this
  one to reconcile. This repo is the standalone reference.

**Working this backlog?** Read `.jagent/planning/RULES.md` first — one worktree/branch per
ticket/milestone + verify-before-fix. Read `.dejavue/context.md` for the operating rules
and the gotchas that bite someone touching the parser.
