# CSON-10 — CI running every implementation against the corpus

| Field | Value |
|-------|-------|
| **ID** | CSON-10 |
| **Priority** | P3 |
| **Status** | Backlog |
| **Phase** | M1 — multi-language parsers on a settled spec |
| **Assignee** | unassigned |
| **Dependencies** | CSON-7 or CSON-8 (worth automating at 3 implementations) |
| **Estimated effort** | S |

## Problem

SPEC §8: *"Parsers must not diverge from the corpus."* Today that is enforced by
remembering to run two test suites by hand. With three or four implementations it stops
being enforceable by memory — which is exactly when divergence becomes silent.

## Success criteria

- [ ] One workflow runs the Rust suite and every `impl/<lang>/` suite on a single checkout
- [ ] A vector added without updating an implementation **fails CI**
- [ ] A cross-check asserts all implementations emit **identical** projections per vector,
      not merely that each matches its own expectations
- [ ] Runs on PRs and on `main`

## Technical approach

- Matrix job per implementation; a final job diffs the projections they produce.
- The cross-check is the valuable part: "each passes its own tests" is weaker than "all
  agree", and the latter is what the corpus exists to guarantee.
- Keep it cheap — these are small, dependency-free suites.

## Files to modify

- `.github/workflows/conformance.yml`
- possibly a small `conformance/run.py` driver shared by the language suites

## Non-goals

- Publishing/release automation (see CSON-3)
- Benchmarking

## Note

`.github/workflows/` needs the `workflow` scope to push — see workspace memory
`reference_github_workflow_scope_push_block` if the push is rejected.
