/**
 * CSON node model — see SPEC.md §3.
 *
 * A node is a value plus optional metadata. Unlike JSON, the value and its
 * metadata travel together, so the model keeps them on one object.
 */

/** A parse or projection error, with position. SPEC §7 requires positional messages. */
export class CsonError extends Error {
  constructor(message, line, col) {
    super(`${message} (line ${line}, column ${col})`);
    this.name = "CsonError";
    this.reason = message;
    this.line = line;
    this.col = col;
  }
}

/** `@name(args) { k: "v" }` — SPEC §4.3. */
export class Annotation {
  constructor(name, args = null, properties = {}) {
    this.name = name;
    this.args = args;
    this.properties = properties;
  }
}

/**
 * `@synthesize("description")` — SPEC §4.4.
 *
 * An instruction, not data. Its own type so a consumer can never mistake it for
 * a literal string; §6 projects it to {"$synthesize": …}.
 */
export class Synthesize {
  constructor(description) {
    this.description = description;
  }
}

/**
 * A value plus its metadata.
 *
 * `confidence` is null when unstated. SPEC §4.2 is explicit that absent is NOT
 * the same as 1.0 — absent means "no claim" — so the two must stay
 * distinguishable. Do not collapse null to 1.0 anywhere.
 */
export class Node {
  constructor(value, confidence = null, annotations = [], semantic = false) {
    this.value = value;
    this.confidence = confidence;
    this.annotations = annotations;
    this.semantic = semantic;
  }
}

/** A parsed document: the root object plus its declared version (§2.5, §9). */
export class Document {
  constructor(root, version = "1.0") {
    this.root = root;
    this.version = version;
  }
}
