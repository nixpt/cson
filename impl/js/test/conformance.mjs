/**
 * Run the language-neutral conformance corpus (SPEC §8).
 *
 * The corpus is the contract: an implementation is conforming iff it passes every
 * vector. This mirrors the Rust reference's tests/conformance.rs and the Python arm.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CsonError, loads } from "../src/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, "..", "..", "..", "conformance");

/** Stable stringify so key order never affects the comparison. */
function canon(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
}

const failures = [];
let ok = 0;

for (const f of readdirSync(join(CORPUS, "valid")).filter((f) => f.endsWith(".cson")).sort()) {
  const stem = f.slice(0, -".cson".length);
  const expected = JSON.parse(readFileSync(join(CORPUS, "valid", `${stem}.expected.json`), "utf8"));
  let got;
  try {
    got = loads(readFileSync(join(CORPUS, "valid", f), "utf8"));
  } catch (e) {
    failures.push(`valid/${f}: threw ${e.name}: ${e.message}`);
    continue;
  }
  if (canon(got) !== canon(expected)) {
    failures.push(`valid/${f}:\n     got ${canon(got)}\n    want ${canon(expected)}`);
  } else ok++;
}

for (const f of readdirSync(join(CORPUS, "invalid")).filter((f) => f.endsWith(".cson")).sort()) {
  const stem = f.slice(0, -".cson".length);
  const needle = readFileSync(join(CORPUS, "invalid", `${stem}.error`), "utf8").trim();
  try {
    loads(readFileSync(join(CORPUS, "invalid", f), "utf8"));
    failures.push(`invalid/${f}: parsed but MUST be rejected (${JSON.stringify(needle)})`);
  } catch (e) {
    if (!(e instanceof CsonError)) {
      failures.push(`invalid/${f}: threw ${e.name}, not CsonError: ${e.message}`);
    } else if (!e.message.toLowerCase().includes(needle.toLowerCase())) {
      failures.push(`invalid/${f}: error ${JSON.stringify(e.message)} lacks ${JSON.stringify(needle)}`);
    } else ok++;
  }
}

for (const f of failures) console.log(`  FAIL ${f}`);
console.log(`\n${ok}/${ok + failures.length} conformance vectors pass`);
process.exit(failures.length ? 1 : 0);
