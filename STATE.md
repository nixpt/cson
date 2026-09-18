# cson — State (2026-09-18)

**Role:** The **language-agnostic home of CSON** — the Crush Semantic Object
Notation format specification plus the Rust reference parser. CSON extends JSON
with four AI-native primitives (semantic keys, confidence weights, annotations,
synthesized values). NOT owned by any language toolchain: `crush-ast` (and any
future consumer) depends on this crate; other languages ship their own parsers
against `SPEC.md`.

**Deps:** `serde` + `serde_json` only (the JSON projection). No crush, no link
to any language runtime — the format crate is embeddable anywhere.

**Build:** `cargo test` (unit + `conformance/`). `cargo fmt --check`, `cargo
clippy --all-targets -- -D warnings`.

**Origin:** scaffolded 2026-09-18 via `foreman-scaffold`; parser ported from
`crush-ast/crates/crush-cson` (language-agnostic parts only — the CrusH `cson.parse`
VM cap stays in crush-ast). Design: `workspace-meta/plans/2026-09-18-cson-standalone-project.md`.

**Remote:** `nixpt/cson` (public).
