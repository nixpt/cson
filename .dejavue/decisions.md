# Decisions


## 2026-09-19T23:55:35-05:00 — [STRATEGIC] [ADOPTED] SPEC 6 projects a node with metadata to a wrapper object, not sibling keys

Reason:
Sibling keys ("<key>$confidence") cannot express metadata on an array element -- SPEC 5 makes an array element a node, but a sibling needs a parent key to hang from. They also collide: a literal t$confidence key clashes with the projection of 't: 1 ~0.5', and the collision is manufactured by the projection so SPEC 3's duplicate-key rule never sees it. And SPEC 6 contradicted itself -- it claimed the projection was reconstructable while the shape the corpus enforced discarded confidence and annotations entirely. The wrapper is keyed on the NODE, so object values and array elements behave identically, $-prefixed keys are reserved so nothing collides, and it round-trips. It also matches the precedent $synthesize already set: a distinguishing object, never a bare value.

Rejected alternatives:
- **sibling keys as originally specified**
- **keep value-only and drop SPEC 6's round-trip claim**

Outcome:
Only 2 of 8 existing valid vectors changed; grammar untouched so format stays 1.0. Rust 13/13, Python 16/16.


## 2026-09-19T23:55:35-05:00 — [TACTICAL] [VERIFIED] Settle the SPEC 6 gap BEFORE writing more language implementations

Reason:
Every new parser inherits an ambiguous contract. Fixing it at two implementations (Rust + Python) is far cheaper than at four. Vindicated immediately: the new conformance vectors exposed two real bugs in the Rust reference that had been invisible because the old projection discarded the evidence.

Outcome:
Found: @cson attaching to the following node instead of setting document version; array elements dropping trailing annotations.


## 2026-09-19T23:55:36-05:00 — [TACTICAL] [PROPOSED] Language implementations live in impl/<lang>/ in this repo, not separate repos

Reason:
The conformance corpus is the contract (SPEC 8). Keeping parsers beside it means tests reference vectors by relative path and one checkout can run every implementation, so a parser cannot silently drift from the corpus. SPEC's 'cson-py' phrasing hints at separate repos; that remains reversible -- the layout moves cleanly.

Rejected alternatives:
- **separate cson-py / cson-js repos**


## 2026-09-20T00:11:39-05:00 — [TACTICAL] [ADOPTED] Every implementation must be cross-checked against the others, not only against its own expectations

Reason:
SPEC 8 promises that parsers do not diverge from the corpus. 'Each implementation passes its own tests' is a weaker claim than 'all implementations agree' -- two parsers can each be self-consistent and still disagree. At three implementations this stops being checkable by hand, so impl/js/test/cross-check.mjs asserts Rust, Python and JavaScript project identically for every vector.

Outcome:
11/11 vectors: corpus(rust) == python == javascript.


## 2026-09-20T00:28:45-05:00 — [STRATEGIC] [ADOPTED] Round-trip is defined at the NODE level, not the byte level

Reason:
The printer cannot recover comments (the parser discards them), and SPEC 2.4 makes [section] sugar equivalent to nesting, so a byte-identical round trip is impossible by construction. Defining the property as 'the projection is unchanged' keeps it meaningful and testable: values, confidence, annotations, semantic keys and version survive; comments, section sugar, key order and bare-vs-quoted key choice do not.

Rejected alternatives:
- **byte-identical round trip**

Outcome:
11/11 vectors round-trip through the Rust printer with identical meaning in all four implementations.


## 2026-09-20T00:39:41-05:00 — [STRATEGIC] [ADOPTED] Node metadata order is FREE: confidence and annotations may interleave

Reason:
The old grammar (node = value {confidence} {annotation}) forced confidence first. Nothing is gained by that ordering -- both are node metadata -- and it was a real trap: cson-corpus hit it and documented a 'write spec order' workaround. Three of four implementations already accepted either order; only Rust did not. Relaxing makes the majority correct and removes the trap. Purely additive: no previously-valid document changes meaning, so the format stays 1.0.

Rejected alternatives:
- **enforce confidence-then-annotations strictly in all four parsers**

Outcome:
A node still carries at most ONE confidence; a second is now an explicit error in all four (it used to be rejected accidentally with a misleading 'semantic key' message).

