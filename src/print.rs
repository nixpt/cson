//! CSON printer — the inverse of the parser, for SPEC §6's reconstructability claim.
//!
//! §6 says a document "can be reconstructed from its projection plus the CSON
//! printer". Nothing verified that until now, because there was no printer.
//!
//! **Round-trip is at the NODE level, not the byte level.** The printer preserves
//! everything that carries meaning — values, confidence, annotations, semantic
//! keys and the document version — and deliberately does not preserve syntax:
//!
//! - **comments** are discarded by the parser and cannot be recovered;
//! - **`[section]` sugar** prints as a nested object (`a: { … }`), which §2.4
//!   defines as equivalent;
//! - **key order** is not preserved (the object model is a `HashMap`);
//! - **bare vs quoted keys** are chosen by what is safe to emit, not by what the
//!   input used.
//!
//! `parse(print(doc))` must equal `doc` in meaning. That property is tested over
//! the whole conformance corpus in `tests/roundtrip.rs`.

use std::fmt::Write as _;

use crate::{CsonAnnotation, CsonDocument, CsonNode, CsonValue};

/// Print a document as CSON.
pub fn print_document(doc: &CsonDocument) -> String {
    let mut out = String::new();
    // Only emit the version line when it is not the default, so a plain document
    // round-trips to a plain document.
    if doc.version != "1.0" {
        let _ = writeln!(out, "@cson {{ version: {} }}", quote(&doc.version));
    }
    if let CsonValue::Object(map) = &doc.root.value {
        // a document's pairs are newline-separated (grammar: document = { pair })
        for (k, v) in map {
            print_pair(&mut out, k, v, 0, "\n");
        }
    }
    out
}

/// Print a single node's value (without a key), e.g. for embedding.
pub fn print_node(node: &CsonNode) -> String {
    let mut out = String::new();
    print_node_into(&mut out, node, 0);
    out
}

fn indent(out: &mut String, depth: usize) {
    for _ in 0..depth {
        out.push_str("  ");
    }
}

fn print_pair(out: &mut String, key: &str, node: &CsonNode, depth: usize, trailing: &str) {
    indent(out, depth);
    out.push_str(&print_key(key));
    out.push_str(": ");
    print_node_into(out, node, depth);
    out.push_str(trailing);
}

/// Keys are stored with the `~` marker intact for semantic keys (see `CsonKey`),
/// so the printer can reconstruct the distinction.
fn print_key(key: &str) -> String {
    if let Some(intent) = key.strip_prefix('~') {
        return format!("~{}", quote(intent));
    }
    if is_safe_bare_key(key) {
        key.to_string()
    } else {
        quote(key)
    }
}

/// A bare key runs up to the first `:` and is whitespace-trimmed (§2.2), so it is
/// only safe when it contains none of the characters that would end it, and does
/// not look like something else (a section, an annotation, a semantic key).
fn is_safe_bare_key(key: &str) -> bool {
    !key.is_empty()
        && key.trim() == key
        && !key.contains([':', '\n', '"', '#', ',', '{', '}', '[', ']'])
        && !key.starts_with('@')
        && !key.starts_with('~')
        && !key.starts_with('$')
}

fn print_node_into(out: &mut String, node: &CsonNode, depth: usize) {
    print_value(out, &node.value, depth);
    if let Some(c) = node.confidence {
        // SPEC §4.2: emit only when STATED. An absent confidence must never
        // become `~1.0` -- that would invent a claim the document did not make.
        let _ = write!(out, " ~{}", number(c));
    }
    for ann in &node.annotations {
        out.push(' ');
        print_annotation(out, ann);
    }
}

fn print_value(out: &mut String, value: &CsonValue, depth: usize) {
    match value {
        CsonValue::String(s) => out.push_str(&quote(s)),
        CsonValue::Number(n) => out.push_str(&number(*n)),
        CsonValue::Boolean(b) => out.push_str(if *b { "true" } else { "false" }),
        CsonValue::Null => out.push_str("null"),
        CsonValue::Synthesize(s) => {
            let _ = write!(out, "@synthesize({})", quote(s));
        }
        CsonValue::Array(items) => {
            if items.is_empty() {
                out.push_str("[]");
                return;
            }
            out.push('[');
            for (i, item) in items.iter().enumerate() {
                if i > 0 {
                    out.push_str(", ");
                }
                print_node_into(out, item, depth);
            }
            out.push(']');
        }
        CsonValue::Object(map) => {
            if map.is_empty() {
                out.push_str("{}");
                return;
            }
            // pairs INSIDE an object are comma-separated (grammar §5:
            // object = "{" [ pair { ws "," ws pair } [ ws "," ] ] "}" ). Emitting
            // them newline-separated only re-parses because our parsers happen to
            // tolerate a missing comma -- a strict one would reject it.
            out.push_str("{\n");
            let last = map.len() - 1;
            for (i, (k, v)) in map.iter().enumerate() {
                print_pair(out, k, v, depth + 1, if i == last { "\n" } else { ",\n" });
            }
            indent(out, depth);
            out.push('}');
        }
    }
}

fn print_annotation(out: &mut String, ann: &CsonAnnotation) {
    let _ = write!(out, "@{}", ann.name);
    if let Some(args) = &ann.args {
        let _ = write!(out, "({})", quote(args));
    }
    if !ann.properties.is_empty() {
        out.push_str(" { ");
        let mut first = true;
        for (k, v) in &ann.properties {
            if !first {
                out.push_str(", ");
            }
            first = false;
            let _ = write!(out, "{}: {}", print_key(k), quote(v));
        }
        out.push_str(" }");
    }
}

/// Format a number so it re-parses to the same f64. Integral values print without
/// a fractional part (`8080`, not `8080.0`) -- SPEC §2.3 makes every number a
/// double, so the spelling carries no information.
fn number(n: f64) -> String {
    if n.is_finite() && n.fract() == 0.0 && n.abs() < 1e15 {
        format!("{}", n as i64)
    } else {
        let s = format!("{n}");
        // guard against a lossy shortest-repr; fall back to full precision
        if s.parse::<f64>() == Ok(n) {
            s
        } else {
            format!("{n:?}")
        }
    }
}

fn quote(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\t' => out.push_str("\\t"),
            '\r' => out.push_str("\\r"),
            c if (c as u32) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

impl CsonDocument {
    /// Print this document as CSON. See [`print_document`].
    pub fn print(&self) -> String {
        print_document(self)
    }
}

impl CsonNode {
    /// Print this node's value and metadata (no key). See [`print_node`].
    pub fn print(&self) -> String {
        print_node(self)
    }
}
