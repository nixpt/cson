/**
 * Spec behaviour the conformance corpus does not fully pin down.
 *
 * These are the places an implementation can diverge while still passing the
 * corpus — notably §4.2's absent-vs-1.0 rule and the node-level metadata that
 * `loads()` callers never see.
 */
import { CsonError, loads, parse, project, projectValues } from "../src/index.mjs";

let checks = 0;
const failures = [];
const canon = (v) => JSON.stringify(v, (k, x) => (x instanceof Map ? Object.fromEntries(x) : x));

function ok(label, got, want) {
  checks++;
  if (canon(got) !== canon(want)) failures.push(`${label}: got ${canon(got)} want ${canon(want)}`);
}
function raises(label, text, needle) {
  checks++;
  try {
    loads(text);
    failures.push(`${label}: expected rejection`);
  } catch (e) {
    if (!(e instanceof CsonError)) failures.push(`${label}: threw ${e.name}, not CsonError`);
    else if (!e.message.toLowerCase().includes(needle.toLowerCase()))
      failures.push(`${label}: error ${JSON.stringify(e.message)} lacks ${JSON.stringify(needle)}`);
  }
}

// --- §4.2 absent confidence is NOT 1.0 -------------------------------------
let d = parse("a: 1\nb: 1 ~1.0");
ok("absent confidence is null", d.root.get("a").confidence, null);
ok("explicit 1.0 is 1.0", d.root.get("b").confidence, 1.0);
ok("absent != explicit", d.root.get("a").confidence === d.root.get("b").confidence, false);
ok("visible in projection", loads("a: 1\nb: 1 ~1.0"),
   { a: 1.0, b: { $value: 1.0, $confidence: 1.0 } });

// --- §4.1 semantic keys ----------------------------------------------------
d = parse('~"billing issues": "route"\nplain: "x"');
ok("semantic flagged", d.root.get("billing issues").semantic, true);
ok("bare key not semantic", d.root.get("plain").semantic, false);

// --- §4.3 annotations ------------------------------------------------------
d = parse('port: 8080 @wip { owner: "foreman" } @urgent');
ok("stacked annotations", d.root.get("port").annotations.map((a) => a.name), ["wip", "urgent"]);
ok("annotation properties", d.root.get("port").annotations[0].properties, { owner: "foreman" });
ok("pending attaches to next node",
   parse('@pending\nkey: "v"').root.get("key").annotations.map((a) => a.name), ["pending"]);
ok("annotation args", parse('model: "x" @cson("1.5")').root.get("model").annotations[0].args, "1.5");
ok("@cson not attached as annotation",
   parse('@cson { version: "1.0" }\nk: 1').root.get("k").annotations, []);

// --- §4.4 synthesize -------------------------------------------------------
ok("synthesize projects to object", loads('accent: @synthesize("a colour")'),
   { accent: { $synthesize: "a colour" } });

// --- §6 wrapper projection -------------------------------------------------
d = parse('t: 21.5 ~0.8 @src { by: "agent" }');
const proj = project(d.root);
ok("wrapper $value", proj.t.$value, 21.5);
ok("wrapper $confidence", proj.t.$confidence, 0.8);
ok("wrapper $annotations", proj.t.$annotations[0].name, "src");
ok("no metadata -> bare value", loads("a: 1"), { a: 1.0 });
ok("array element metadata wraps", loads("a: [1 ~0.5, 2]"),
   { a: [{ $value: 1.0, $confidence: 0.5 }, 2.0] });
ok("value-only helper drops metadata", projectValues(d.root), { t: 21.5 });
raises("reserved $ key rejected", "$value: 1", "reserved");

// --- §2 lexical ------------------------------------------------------------
ok("comments anywhere", loads("# lead\na: 1  # trail\n"), { a: 1.0 });
ok("trailing comma object", loads("a: { x: 1, }"), { a: { x: 1.0 } });
ok("trailing comma array", loads("a: [1, 2, ]"), { a: [1.0, 2.0] });
ok("nested", loads("a: { b: { c: [1] } }"), { a: { b: { c: [1.0] } } });
ok("escapes", loads('a: "x\\ny\\"z"'), { a: 'x\ny"z' });

// --- §7 errors are positional and typed ------------------------------------
raises("duplicate key", "a: 1\na: 2", "Duplicate key");
raises("confidence > 1", "a: 1 ~1.5", "outside");
raises("confidence < 0", "a: 1 ~-0.5", "outside");
raises("missing colon", "port 8080", "colon");
raises("unclosed object", "x: { a: 1", "Unclosed");
raises("unclosed string", 'x: "abc', "Unclosed string");
raises("unclosed synthesize", 'x: @synthesize("no close"', "Unclosed");
raises("unclosed section", "[unclosed\nx: 1", "Unclosed section");

checks++;
try { parse("a: 1\na: 2"); } catch (e) {
  if (e.line !== 2) failures.push(`error line: got ${e.line} want 2`);
}

// --- §2.5/§9 version -------------------------------------------------------
ok("version default", parse("k: 1").version, "1.0");
ok("version props form", parse('@cson { version: "1.1" }\nk: 1').version, "1.1");
ok("version args form", parse('@cson("2.0")\nk: 1').version, "2.0");

for (const f of failures) console.log(`  FAIL ${f}`);
console.log(`\n${checks - failures.length}/${checks} spec checks pass`);
process.exit(failures.length ? 1 : 0);
