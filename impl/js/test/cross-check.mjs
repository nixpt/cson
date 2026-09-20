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
import { readFileSync, readdirSync } from "node:fs";
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

const pyAvailable = (() => {
  try { execFileSync("python3", ["-c", "import sys"], { stdio: "ignore" }); return true; }
  catch { return false; }
})();

let ok = 0;
const failures = [];

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

  const distinct = new Set(Object.values(shapes));
  if (distinct.size === 1) ok++;
  else failures.push(`${f}: implementations disagree\n` +
    Object.entries(shapes).map(([k, v]) => `      ${k.padEnd(11)} ${v}`).join("\n"));
}

for (const f of failures) console.log(`  FAIL ${f}`);
const impls = pyAvailable ? "corpus(rust) == python == javascript" : "corpus(rust) == javascript";
console.log(`\n${ok}/${ok + failures.length} vectors: ${impls}`);
process.exit(failures.length ? 1 : 0);
