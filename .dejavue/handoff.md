# Handoff

Updated: 2026-09-19T23:56:24-05:00

## Summary
SPEC 6 settled on a single wrapper rule and the first non-Rust parser landed. The new vectors immediately exposed two real bugs in the Rust reference (@cson attaching to the next node; array elements dropping annotations), both now fixed. Projection moved out of the test harness into src/project.rs.

## Next Steps
Parsers for JavaScript/TypeScript then Go, built against the settled contract. A CSON printer (parse-only today). Close from_json round-trip against the wrapper projection. Read SPEC.md then conformance/README.md before changing anything -- the corpus is the contract, and a parser must never diverge from it.

## Boot Instructions
Read `.dejavue/handoff.md`, `.dejavue/state.md`, `.dejavue/decisions.md`, and `.dejavue/timeline.jsonl` before making changes.
