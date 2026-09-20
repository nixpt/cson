"""Spec behaviour the conformance corpus does not (yet) pin down.

These are the places an implementation can silently diverge while still passing
the 13 corpus vectors -- notably §4.2's absent-vs-1.0 rule, which the corpus
cannot test because its projection drops confidence entirely.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import cson  # noqa: E402

checks, failures = 0, []


def ok(label, got, want):
    global checks
    checks += 1
    if got != want:
        failures.append(f"{label}: got {got!r} want {want!r}")


def raises(label, text, needle):
    global checks
    checks += 1
    try:
        cson.parse(text)
    except cson.CsonError as e:
        if needle.lower() not in str(e).lower():
            failures.append(f"{label}: error {str(e)!r} lacks {needle!r}")
    else:
        failures.append(f"{label}: expected rejection")


# --- §4.2 absent confidence is NOT 1.0 -------------------------------------
d = cson.parse('a: 1\nb: 1 ~1.0')
ok("absent confidence is None", d.root["a"].confidence, None)
ok("explicit 1.0 is 1.0", d.root["b"].confidence, 1.0)
ok("absent != explicit", d.root["a"].confidence == d.root["b"].confidence, False)

# --- §4.1 semantic keys ----------------------------------------------------
d = cson.parse('~"billing issues": "route"\nplain: "x"')
ok("semantic flagged", d.root["billing issues"].semantic, True)
ok("bare key not semantic", d.root["plain"].semantic, False)
ok("semantic key text verbatim", "billing issues" in d.root, True)

# --- §4.3 annotations: args, properties, stacking, pending -----------------
d = cson.parse('port: 8080 @wip { owner: "foreman" } @urgent')
anns = d.root["port"].annotations
ok("two stacked annotations", [a.name for a in anns], ["wip", "urgent"])
ok("annotation properties", anns[0].properties, {"owner": "foreman"})
d = cson.parse('@pending\nkey: "v"')
ok("pending annotation attaches to next node",
   [a.name for a in d.root["key"].annotations], ["pending"])
d = cson.parse('model: "x" @cson("1.5")')
ok("annotation args parsed", d.root["model"].annotations[0].args, "1.5")

# --- §4.4 synthesize is never a bare string --------------------------------
d = cson.parse('accent: @synthesize("a colour")')
ok("synthesize type", type(d.root["accent"].value).__name__, "Synthesize")
ok("synthesize projects to object", cson.loads('accent: @synthesize("a colour")'),
   {"accent": {"$synthesize": "a colour"}})

# --- §6 full projection (the spec target shape) ----------------------------
doc = cson.parse('t: 21.5 ~0.8 @src { by: "agent" }')
full = cson.project_full(doc.root)
ok("full: value", full["t"], 21.5)
ok("full: $confidence", full["t$confidence"], 0.8)
ok("full: $annotations", full["t$annotations"][0]["name"], "src")
ok("value-only projection omits them", cson.project(doc.root), {"t": 21.5})

# --- §2 lexical: comments, trailing commas, nesting ------------------------
ok("comment anywhere", cson.loads('# lead\na: 1  # trail\n'), {"a": 1.0})
ok("trailing comma object", cson.loads('a: { x: 1, }'), {"a": {"x": 1.0}})
ok("trailing comma array", cson.loads('a: [1, 2, ]'), {"a": [1.0, 2.0]})
ok("nested", cson.loads('a: { b: { c: [1] } }'), {"a": {"b": {"c": [1.0]}}})
ok("escapes", cson.loads(r'a: "x\ny\"z"'), {"a": 'x\ny"z'})

# --- §7 errors are positional and typed ------------------------------------
raises("duplicate key", "a: 1\na: 2", "Duplicate key")
raises("confidence > 1", "a: 1 ~1.5", "outside")
raises("confidence < 0", "a: 1 ~-0.5", "outside")
raises("missing colon", "port 8080", "colon")
raises("unclosed object", "x: { a: 1", "Unclosed")
raises("unclosed string", 'x: "abc', "Unclosed string")
raises("unclosed synthesize", 'x: @synthesize("no close"', "Unclosed")
raises("unclosed section", "[unclosed\nx: 1", "Unclosed section")

try:
    cson.parse("a: 1\na: 2")
except cson.CsonError as e:
    checks += 1
    if e.line != 2:
        failures.append(f"error line: got {e.line} want 2")

# --- §2.5/§9 version surfaced to the caller --------------------------------
ok("version default", cson.parse('k: 1').version, "1.0")
ok("version props form", cson.parse('@cson { version: "1.1" }\nk: 1').version, "1.1")
ok("version args form", cson.parse('@cson("2.0")\nk: 1').version, "2.0")
ok("@cson not attached as annotation",
   cson.parse('@cson { version: "1.0" }\nk: 1').root["k"].annotations, ())

for f in failures:
    print(f"  FAIL {f}")
print(f"\n{checks - len(failures)}/{checks} spec checks pass")
sys.exit(1 if failures else 0)
