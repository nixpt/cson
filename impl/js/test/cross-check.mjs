/**
 * Cross-implementation check: every implementation must project IDENTICALLY.
 *
 * "Each passes its own tests" is weaker than "all agree", and agreement is what
 * the corpus exists to guarantee (SPEC §8).
 *
 * NOTE on numbers: SPEC §2.3 makes all numbers IEEE-754 doubles, but languages
 * RENDER them differently — Python emits `8080.0`, JavaScript emits `8080`. A
 * string comparison across languages therefore reports false divergence. Numbers
 * are normalised before comparing; only the values matter.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loads } from "../src/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const CORPUS = join(ROOT, "conformance");

/** Stable stringify with numbers normalised, so 8080 and 8080.0 compare equal. */
function canon(v) {
  if (typeof v === "number") return Number.isFinite(v) ? `#${v.toExponential(15)}` : `#${v}`;
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
}

const have = (cmd, args) => {
  try { execFileSync(cmd, args, { stdio: "ignore" }); return true; } catch { return false; }
};
const pyAvailable = have("python3", ["-c", "import sys"]);
const goAvailable = have("go", ["version"]);

// Skipping a missing toolchain is right locally and WRONG in CI: a failed Go
// install would make this pass while comparing nothing. CSON_CROSSCHECK_REQUIRE
// names the implementations that must be present, so CI fails loudly instead of
// quietly narrowing its own coverage.
const AVAILABLE = { python: pyAvailable, go: goAvailable };
const required = (process.env.CSON_CROSSCHECK_REQUIRE || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

// An unknown name must be an error, not a silent no-op: `REQUIRE=rust` quietly
// requiring nothing is the same blind spot one level up.
const unknown = required.filter((r) => !(r in AVAILABLE));
if (unknown.length) {
  console.error(`unknown implementation(s) in CSON_CROSSCHECK_REQUIRE: ${unknown.join(", ")}`);
  console.error(`known: ${Object.keys(AVAILABLE).join(", ")} (rust is the corpus baseline, always compared)`);
  process.exit(2);
}
const missing = required.filter((r) => !AVAILABLE[r]);
if (missing.length) {
  console.error(`required implementation(s) unavailable: ${missing.join(", ")}`);
  process.exit(2);
}

const rustAvailable = have("cargo", ["--version"]);

let ok = 0;
let roundTripOk = 0;
const failures = [];

/** Ask the Rust reference to print a document back out (CSON-9). */
function rustPrint(file) {
  return execFileSync("cargo", ["run", "--quiet", "--example", "print_demo", "--", file],
    { cwd: ROOT, encoding: "utf8" });
}

for (const f of readdirSync(join(CORPUS, "valid")).filter((f) => f.endsWith(".cson")).sort()) {
  const text = readFileSync(join(CORPUS, "valid", f), "utf8");
  const stem = f.slice(0, -".cson".length);
  const expected = JSON.parse(readFileSync(join(CORPUS, "valid", `${stem}.expected.json`), "utf8"));
  const js = loads(text);

  const shapes = { corpus: canon(expected), javascript: canon(js) };
  if (pyAvailable) {
    const out = execFileSync("python3", ["-c",
      "import sys,json;sys.path.insert(0,'impl/python');import cson;" +
      "print(json.dumps(cson.loads(open(sys.argv[1]).read())))",
      join(CORPUS, "valid", f)], { cwd: ROOT, encoding: "utf8" });
    shapes.python = canon(JSON.parse(out));
  }

  if (goAvailable) {
    const out = execFileSync("go", ["run", "./cmd/project", join(CORPUS, "valid", f)],
      { cwd: join(ROOT, "impl", "go"), encoding: "utf8" });
    shapes.go = canon(JSON.parse(out));
  }

  const distinct = new Set(Object.values(shapes));
  if (distinct.size === 1) ok++;
  else failures.push(`${f}: implementations disagree\n` +
    Object.entries(shapes).map(([k, v]) => `      ${k.padEnd(11)} ${v}`).join("\n"));

  // CSON-6: the PRINTED form must mean the same thing, to every implementation.
  // SPEC §6 claims a document is reconstructable; this makes that claim
  // cross-language rather than a property of one parser/printer pair.
  if (!rustAvailable) continue;
  let printed;
  try {
    printed = rustPrint(join(CORPUS, "valid", f));
  } catch (e) {
    failures.push(`${f}: rust printer failed: ${e.message.split("\n")[0]}`);
    continue;
  }
  const rt = { "original(js)": canon(js), "printed(js)": canon(loads(printed)) };
  if (pyAvailable) {
    const out = execFileSync("python3", ["-c",
      "import sys,json;sys.path.insert(0,'impl/python');import cson;" +
      "print(json.dumps(cson.loads(sys.stdin.read())))"],
      { cwd: ROOT, encoding: "utf8", input: printed });
    rt["printed(py)"] = canon(JSON.parse(out));
  }
  if (goAvailable) {
    const tmp = join(ROOT, ".printed.tmp.cson");
    writeFileSync(tmp, printed);
    try {
      const out = execFileSync("go", ["run", "./cmd/project", tmp],
        { cwd: join(ROOT, "impl", "go"), encoding: "utf8" });
      rt["printed(go)"] = canon(JSON.parse(out));
    } finally { unlinkSync(tmp); }
  }
  if (new Set(Object.values(rt)).size !== 1) {
    failures.push(`${f}: round-trip through the printer changed meaning\n` +
      Object.entries(rt).map(([k, v]) => `      ${k.padEnd(13)} ${v}`).join("\n") +
      `\n--- printed ---\n${printed}`);
  } else roundTripOk++;
}

for (const f of failures) console.log(`  FAIL ${f}`);
const impls = ["corpus(rust)", "javascript",
  ...(pyAvailable ? ["python"] : []), ...(goAvailable ? ["go"] : [])].join(" == ");
console.log(`\n${ok} vectors: ${impls}`);
if (rustAvailable) {
  console.log(`${roundTripOk} vectors: printed form re-parses to the same meaning in every implementation (CSON-6)`);
}
process.exit(failures.length ? 1 : 0);
