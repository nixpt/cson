# State

Updated: 2026-09-20T00:22:13-05:00

Format v1.0 draft, SPEC 6 settled. FOUR implementations -- Rust (src/), Python (impl/python/), JavaScript (impl/js/), Go (impl/go/) -- all passing the corpus and cross-checked to project identically. CI (.github/workflows/conformance.yml) runs each plus the cross-check. Corpus: 11 valid + 5 invalid. Next: CSON-9 printer (unblocks CSON-6 round-trip), CSON-2 fuller corpus, CSON-3 crates.io.
