/**
 * CSON parser — a direct implementation of SPEC.md §2–§5.
 *
 * Hand-written recursive descent over a character cursor. No dependencies, and
 * nothing platform-specific: this module runs unchanged in Node and a browser.
 */
import { Annotation, CsonError, Document, Node, Synthesize } from "./model.mjs";

const ESCAPES = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" };

class Cursor {
  constructor(s) {
    this.s = s;
    this.i = 0;
    this.n = s.length;
  }

  /** Position is derived, not tracked, so the cursor stays cheap to rewind. */
  pos(at = this.i) {
    let line = 1;
    for (let k = 0; k < at; k++) if (this.s[k] === "\n") line++;
    const nl = this.s.lastIndexOf("\n", at - 1);
    return [line, at - nl];
  }

  err(msg, at = this.i) {
    const [line, col] = this.pos(at);
    return new CsonError(msg, line, col);
  }

  eof() { return this.i >= this.n; }
  peek() { return this.i < this.n ? this.s[this.i] : ""; }

  /**
   * Whitespace is insignificant except in strings; comments run `#` -> EOL and
   * may appear anywhere whitespace may (SPEC §2.1).
   */
  skipWs(newlines = true) {
    while (this.i < this.n) {
      const c = this.s[this.i];
      if (c === "#") {
        const j = this.s.indexOf("\n", this.i);
        this.i = j < 0 ? this.n : j;
      } else if (c === "\n") {
        if (!newlines) return;
        this.i++;
      } else if (c === " " || c === "\t" || c === "\r") {
        this.i++;
      } else return;
    }
  }
}

function parseString(c) {
  const start = c.i;
  if (c.peek() !== '"') throw c.err("Expected a string");
  c.i++;
  let out = "";
  for (;;) {
    if (c.eof()) throw c.err("Unclosed string", start);
    const ch = c.s[c.i];
    if (ch === '"') { c.i++; return out; }
    if (ch === "\\") {
      c.i++;
      if (c.eof()) throw c.err("Unclosed string", start);
      const e = c.s[c.i];
      if (e === "u") {
        const hex = c.s.slice(c.i + 1, c.i + 5);
        if (hex.length < 4) throw c.err("Truncated \\u escape");
        out += String.fromCharCode(parseInt(hex, 16));
        c.i += 4;
      } else {
        out += ESCAPES[e] !== undefined ? ESCAPES[e] : e;
      }
      c.i++;
    } else {
      out += ch;
      c.i++;
    }
  }
}

function parseNumber(c) {
  const start = c.i;
  if (c.peek() === "+" || c.peek() === "-") c.i++;
  while (c.i < c.n) {
    const ch = c.s[c.i];
    const isNum = (ch >= "0" && ch <= "9") || ch === "." || ch === "e" || ch === "E" ||
                  ch === "+" || ch === "-";
    if (!isNum) break;
    // stop at a sign that is not part of an exponent
    if ((ch === "+" || ch === "-") && !(c.s[c.i - 1] === "e" || c.s[c.i - 1] === "E")) break;
    c.i++;
  }
  const text = c.s.slice(start, c.i);
  const v = Number(text);
  // SPEC §2.3: all numbers are IEEE-754 doubles
  if (text === "" || Number.isNaN(v)) throw c.err(`Invalid number ${JSON.stringify(text)}`, start);
  return v;
}

function parseBareProp(c) {
  const k = c.i;
  while (c.i < c.n && c.s[c.i] !== "," && c.s[c.i] !== "}" && c.s[c.i] !== "\n") c.i++;
  return c.s.slice(k, c.i).trim();
}

function parseAnnotation(c) {
  const start = c.i;
  c.i++; // '@'
  const j = c.i;
  while (c.i < c.n && /[A-Za-z0-9_-]/.test(c.s[c.i])) c.i++;
  const name = c.s.slice(j, c.i);
  if (!name) throw c.err("Annotation needs a name", start);

  let args = null;
  let save = c.i;
  c.skipWs(false);
  if (c.peek() === "(") {
    const openAt = c.i;
    c.i++;
    const k = c.s.indexOf(")", c.i);
    if (k < 0) throw c.err("Unclosed annotation arguments", openAt);
    args = c.s.slice(c.i, k).trim().replace(/^"|"$/g, "");
    c.i = k + 1;
  } else c.i = save;

  const props = {};
  save = c.i;
  c.skipWs(false);
  if (c.peek() === "{") {
    const openAt = c.i;
    c.i++;
    for (;;) {
      c.skipWs();
      if (c.eof()) throw c.err("Unclosed annotation properties", openAt);
      if (c.peek() === "}") { c.i++; break; }
      const k = c.i;
      while (c.i < c.n && !":,}".includes(c.s[c.i])) c.i++;
      const pname = c.s.slice(k, c.i).trim();
      if (c.peek() !== ":") throw c.err("Malformed annotation property: expected a colon", k);
      c.i++;
      c.skipWs();
      props[pname] = c.peek() === '"' ? parseString(c) : parseBareProp(c);
      c.skipWs();
      if (c.peek() === ",") c.i++; // trailing comma permitted (§5)
    }
  } else c.i = save;

  return new Annotation(name, args, props);
}

function parseValue(c) {
  c.skipWs();
  const ch = c.peek();
  if (ch === "") throw c.err("Expected a value");
  if (ch === '"') return parseString(c);
  if (ch === "{") return parseObject(c);
  if (ch === "[") return parseArray(c);
  if (ch === "@") {
    const at = c.i;
    if (c.s.startsWith("@synthesize", c.i)) {
      c.i += "@synthesize".length;
      c.skipWs();
      if (c.peek() !== "(") throw c.err("@synthesize needs a parenthesised description", at);
      c.i++;
      c.skipWs();
      const desc = parseString(c);
      c.skipWs();
      if (c.peek() !== ")") throw c.err("Unclosed @synthesize", at);
      c.i++;
      return new Synthesize(desc);
    }
    throw c.err("Unexpected annotation where a value was expected", at);
  }
  for (const [word, val] of [["true", true], ["false", false], ["null", null]]) {
    if (c.s.startsWith(word, c.i)) {
      const nxt = c.s[c.i + word.length] ?? "";
      if (!/[A-Za-z0-9_]/.test(nxt)) { c.i += word.length; return val; }
    }
  }
  if (/[0-9+\-.]/.test(ch)) return parseNumber(c);
  throw c.err(`Unexpected character ${JSON.stringify(ch)} where a value was expected`);
}

/** node := value (ws '~' number)? (ws annotation)*  — SPEC §3 */
function parseNode(c, pending) {
  const value = parseValue(c);
  let conf = null;
  const anns = [...pending];
  for (;;) {
    const save = c.i;
    c.skipWs(false);
    if (c.peek() === "~") {
      // A node carries at most one confidence (SPEC §3). Without this the second
      // `~` falls through to key parsing and reports a misleading "semantic key"
      // error.
      if (conf !== null) throw c.err("Duplicate confidence on a node");
      const at = c.i;
      c.i++;
      c.skipWs(false);
      conf = parseNumber(c);
      if (!(conf >= 0 && conf <= 1)) throw c.err(`Confidence ${conf} outside [0.0, 1.0]`, at);
      continue;
    }
    if (c.peek() === "@") { anns.push(parseAnnotation(c)); continue; }
    c.i = save;
    break;
  }
  return new Node(value, conf, anns);
}

function parseObject(c) {
  const openAt = c.i;
  c.i++; // '{'
  const out = new Map();
  for (;;) {
    c.skipWs();
    if (c.eof()) throw c.err("Unclosed object", openAt);
    if (c.peek() === "}") { c.i++; return out; }
    const [key, semantic] = parseKey(c);
    if (out.has(key)) throw c.err(`Duplicate key ${JSON.stringify(key)}`);
    const node = parseNode(c, []);
    node.semantic = semantic;
    out.set(key, node);
    c.skipWs();
    if (c.peek() === ",") c.i++; // trailing comma permitted
  }
}

function parseArray(c) {
  const openAt = c.i;
  c.i++; // '['
  const out = [];
  for (;;) {
    c.skipWs();
    if (c.eof()) throw c.err("Unclosed array", openAt);
    if (c.peek() === "]") { c.i++; return out; }
    // an array element is a NODE (§5) and may carry confidence and annotations
    out.push(parseNode(c, []));
    c.skipWs();
    if (c.peek() === ",") c.i++;
  }
}

/** key := semantic_key | quoted_key | bare_key — SPEC §2.2 */
function parseKey(c) {
  c.skipWs();
  let semantic = false;
  let key;
  if (c.peek() === "~") {
    const save = c.i;
    c.i++;
    c.skipWs(false);
    if (c.peek() !== '"') { c.i = save; throw c.err("A semantic key must be ~ followed by a quoted string"); }
    key = parseString(c);
    semantic = true;
  } else if (c.peek() === '"') {
    key = parseString(c);
  } else {
    const start = c.i;
    while (c.i < c.n && c.s[c.i] !== ":" && c.s[c.i] !== "\n") c.i++;
    key = c.s.slice(start, c.i).trim();
    if (!key) throw c.err("Expected a key", start);
  }
  c.skipWs(false);
  if (c.peek() !== ":") throw c.err(`Key ${JSON.stringify(key)} must be followed by a colon`);
  c.i++;
  return [key, semantic];
}

/** Parse a CSON document. Throws CsonError with position on failure. */
export function parse(text) {
  const c = new Cursor(text);
  const root = new Map();
  let version = "1.0";
  let pending = [];
  let section = null;

  for (;;) {
    c.skipWs();
    if (c.eof()) break;
    const ch = c.peek();

    if (ch === "[") { // section (§2.4)
      const openAt = c.i;
      c.i++;
      const j = c.s.indexOf("]", c.i);
      const nl = c.s.indexOf("\n", c.i);
      if (j < 0 || (nl >= 0 && nl < j)) throw c.err("Unclosed section", openAt);
      const name = c.s.slice(c.i, j).trim();
      c.i = j + 1;
      if (root.has(name)) throw c.err(`Duplicate key ${JSON.stringify(name)}`, openAt);
      section = new Map();
      root.set(name, new Node(section));
      continue;
    }

    if (ch === "@") {
      const ann = parseAnnotation(c);
      if (ann.name === "cson") {
        // reserved for document metadata (§2.5): sets the version and does NOT
        // attach to the next node
        version = ann.properties.version || ann.args || version;
      } else {
        pending.push(ann); // attaches to the NEXT node (§4.3)
      }
      continue;
    }

    const [key, semantic] = parseKey(c);
    const target = section !== null ? section : root;
    if (target.has(key)) throw c.err(`Duplicate key ${JSON.stringify(key)}`);
    const node = parseNode(c, pending);
    node.semantic = semantic;
    pending = [];
    target.set(key, node);
  }

  return new Document(root, version);
}
