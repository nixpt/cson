"""Run the language-neutral conformance corpus (SPEC §8).

The corpus is the contract: an implementation is conforming iff it passes every
vector. This mirrors the Rust reference's tests/conformance.rs.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import cson  # noqa: E402

CORPUS = ROOT / "conformance"


def run() -> int:
    failures = []
    n_ok = 0

    for src in sorted((CORPUS / "valid").glob("*.cson")):
        expected_path = src.with_suffix("").with_suffix(".expected.json")
        if not expected_path.exists():
            expected_path = src.parent / (src.stem + ".expected.json")
        expected = json.loads(expected_path.read_text())
        try:
            got = cson.loads(src.read_text())
        except Exception as e:  # noqa: BLE001
            failures.append(f"valid/{src.name}: raised {type(e).__name__}: {e}")
            continue
        if got != expected:
            failures.append(f"valid/{src.name}:\n     got {json.dumps(got, sort_keys=True)}"
                            f"\n    want {json.dumps(expected, sort_keys=True)}")
        else:
            n_ok += 1

    for src in sorted((CORPUS / "invalid").glob("*.cson")):
        needle = (src.parent / (src.stem + ".error")).read_text().strip()
        try:
            cson.loads(src.read_text())
        except cson.CsonError as e:
            if needle.lower() in str(e).lower():
                n_ok += 1
            else:
                failures.append(f"invalid/{src.name}: error {str(e)!r} lacks {needle!r}")
        except Exception as e:  # noqa: BLE001
            failures.append(f"invalid/{src.name}: raised {type(e).__name__} not CsonError: {e}")
        else:
            failures.append(f"invalid/{src.name}: parsed but MUST be rejected ({needle!r})")

    total = n_ok + len(failures)
    for f in failures:
        print(f"  FAIL {f}")
    print(f"\n{n_ok}/{total} conformance vectors pass")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(run())
