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

