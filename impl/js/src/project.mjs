/**
 * JSON projection — SPEC.md §6.
 *
 * One rule: a node with no metadata projects to its bare value; a node carrying
 * confidence or annotations projects to a wrapper object
 *
 *     {"$value": …, "$confidence": …, "$annotations": [ … ]}
 *
 * with the metadata members omitted when absent. Because the wrapper is keyed on
 * the NODE and not on its parent's key, it applies identically to object values
 * and array elements — an array element is a node and may carry metadata.
 *
 * This keeps absent confidence distinguishable from an explicit ~1.0 (§4.2): the
 * `$confidence` member is present only when stated.
 */
import { CsonError, Node, Synthesize } from "./model.mjs";

const RESERVED_PREFIX = "$";

function annotationsOf(node) {
  return node.annotations.map((a) => ({
    name: a.name,
    args: a.args,
    properties: { ...a.properties },
  }));
}

/** Bare value when the node carries no metadata, wrapper object otherwise. */
function wrap(node, projected) {
  if (node.confidence === null && node.annotations.length === 0) return projected;
  const out = { $value: projected };
  if (node.confidence !== null) out.$confidence = node.confidence;
  if (node.annotations.length) out.$annotations = annotationsOf(node);
  return out;
}

function projectValue(v) {
  if (v instanceof Synthesize) {
    // an object, never a bare string, so it cannot be mistaken for data (§4.4)
    return { $synthesize: v.description };
  }
  if (v instanceof Map) return projectObject(v);
  if (Array.isArray(v)) return v.map((n) => (n instanceof Node ? projectNode(n) : projectValue(n)));
  return v;
}

function projectNode(node) {
  return wrap(node, projectValue(node.value));
}

function projectObject(map) {
  const out = {};
  for (const [key, node] of map) {
    // §6 reserves $-prefixed keys so a document key can never collide with the
    // wrapper members.
    if (key.startsWith(RESERVED_PREFIX)) {
      throw new CsonError(`Key ${JSON.stringify(key)} uses the reserved '$' prefix`, 0, 0);
    }
    out[key] = node instanceof Node ? projectNode(node) : projectValue(node);
  }
  return out;
}

/** The SPEC §6 projection. */
export function project(root) {
  return projectObject(root);
}

/**
 * Value-only projection: drops all metadata.
 *
 * Not the spec projection — a convenience for callers that want plain data and
 * have no use for confidence or annotations. Lossy by construction.
 */
export function projectValues(root) {
  const val = (v) => {
    if (v instanceof Synthesize) return { $synthesize: v.description };
    if (v instanceof Map) {
      const o = {};
      for (const [k, n] of v) o[k] = n instanceof Node ? val(n.value) : val(n);
      return o;
    }
    if (Array.isArray(v)) return v.map((n) => (n instanceof Node ? val(n.value) : val(n)));
    return v;
  };
  return val(root);
}
