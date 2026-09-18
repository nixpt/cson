# CSON conformance corpus

Language-neutral test vectors. **An implementation is conforming iff it passes
every vector here.** Run it from any language — the vectors are plain data, not
code.

See [`../SPEC.md`](../SPEC.md) §8.

## Layout

```
valid/<name>.cson        a document a conforming parser MUST accept
valid/<name>.expected.json   its required JSON projection (SPEC §6)
invalid/<name>.cson      a document a conforming parser MUST reject
invalid/<name>.error     a substring the error message MUST contain
```

## Running the Rust reference parser

```bash
cargo test --test conformance
```

(`tests/conformance.rs` walks these files.) Other implementations should mirror
that: read every `valid/*.cson`, assert the parse succeeds and projects to the
matching `.expected.json`; read every `invalid/*.cson`, assert the parse fails
with a message containing the `.error` substring.

## Adding a vector

A grammar change is a spec change (SPEC §9): add the vector here, bump the
format version if it is breaking, and update every parser. Never let a parser
diverge from the corpus — the corpus is the contract.
