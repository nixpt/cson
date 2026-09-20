# Invariants


## 2026-09-19T23:55:50-05:00

Absent confidence is NOT 1.0 (SPEC 4.2). Absent means 'no claim'; every parser must keep the two distinguishable, including in the JSON projection.

## 2026-09-19T23:55:51-05:00

The conformance corpus is the contract (SPEC 8). A parser is conforming iff it passes every vector; a grammar or projection change means updating the corpus and EVERY implementation in the same commit.

## 2026-09-19T23:55:51-05:00

Keys beginning with '$' are reserved in a projected object, so a document key can never collide with a wrapper member ($value / $confidence / $annotations / $synthesize).
