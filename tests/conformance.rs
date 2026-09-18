//! Conformance runner — walks `conformance/` and asserts the reference parser
//! matches the spec. See `conformance/README.md` and `SPEC.md` §8.
//!
//! Vectors are plain data, so any language can run them; this is the Rust arm.

use std::fs;
use std::path::{Path, PathBuf};

use cson::{CsonParser, CsonValue};

fn conformance_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("conformance")
}

fn valid_docs() -> Vec<PathBuf> {
    let dir = conformance_dir().join("valid");
    let mut v: Vec<PathBuf> = fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("read {}: {e}", dir.display()))
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|x| x == "cson"))
        .collect();
    v.sort();
    v
}

fn invalid_docs() -> Vec<PathBuf> {
    let dir = conformance_dir().join("invalid");
    let mut v: Vec<PathBuf> = fs::read_dir(&dir)
        .unwrap_or_else(|e| panic!("read {}: {e}", dir.display()))
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|x| x == "cson"))
        .collect();
    v.sort();
    v
}

/// Normalise a JSON string for comparison: parse both sides and re-serialize
/// with sorted keys + a uniform number format, so vector authoring style does
/// not affect the result.
fn canon(json: &str) -> String {
    let v: serde_json::Value = serde_json::from_str(json).expect("vector json parses");
    canon_value(&v)
}

fn canon_value(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::Object(m) => {
            let mut keys: Vec<&String> = m.keys().collect();
            keys.sort();
            let inner: Vec<String> = keys
                .iter()
                .map(|k| {
                    format!(
                        "{}:{}",
                        serde_json::to_string(k).unwrap(),
                        canon_value(&m[*k])
                    )
                })
                .collect();
            format!("{{{}}}", inner.join(","))
        }
        serde_json::Value::Array(a) => {
            let inner: Vec<String> = a.iter().map(canon_value).collect();
            format!("[{}]", inner.join(","))
        }
        serde_json::Value::Number(n) => {
            // integers and floats compare equal in the corpus
            let f = n.as_f64().unwrap_or(0.0);
            if f.fract() == 0.0 {
                format!("{}", f as i64)
            } else {
                format!("{f}")
            }
        }
        other => serde_json::to_string(other).unwrap(),
    }
}

/// Project a CSON document to the SPEC §6 JSON shape the corpus expects.
fn project(doc: &cson::CsonDocument) -> serde_json::Value {
    node_to_json_project(&doc.root)
}

fn node_to_json_project(node: &cson::CsonNode) -> serde_json::Value {
    match &node.value {
        CsonValue::String(s) => serde_json::Value::String(s.clone()),
        CsonValue::Number(n) => serde_json::Number::from_f64(*n)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null),
        CsonValue::Boolean(b) => serde_json::Value::Bool(*b),
        CsonValue::Null => serde_json::Value::Null,
        CsonValue::Synthesize(s) => {
            let mut m = serde_json::Map::new();
            m.insert("$synthesize".into(), serde_json::Value::String(s.clone()));
            serde_json::Value::Object(m)
        }
        CsonValue::Array(items) => {
            serde_json::Value::Array(items.iter().map(node_to_json_project).collect())
        }
        CsonValue::Object(map) => {
            let mut out = serde_json::Map::new();
            for (k, v) in map {
                // SPEC §6: a semantic key projects to its bare intent text — the
                // `~` marker is syntax, not data. (The internal map key keeps the
                // marker so the printer can round-trip it.)
                let key = k.strip_prefix('~').unwrap_or(k);
                out.insert(key.to_string(), node_to_json_project(v));
            }
            serde_json::Value::Object(out)
        }
    }
}

#[test]
fn valid_vectors_parse_and_project() {
    let docs = valid_docs();
    assert!(!docs.is_empty(), "no valid vectors found");
    let mut failures = Vec::new();
    for path in &docs {
        let src = fs::read_to_string(path).unwrap();
        let doc = match CsonParser::new(&src).parse() {
            Ok(d) => d,
            Err(e) => {
                failures.push(format!("{}: parse failed: {e}", path.display()));
                continue;
            }
        };
        let expected_path = path.with_extension("expected.json");
        let expected = fs::read_to_string(&expected_path)
            .unwrap_or_else(|e| panic!("missing {}: {e}", expected_path.display()));
        let got = serde_json::to_string(&project(&doc)).unwrap();
        let (g, w) = (canon(&got), canon(&expected));
        if g != w {
            failures.push(format!(
                "{}: projection mismatch\n  got:      {g}\n  expected: {w}",
                path.display()
            ));
        }
    }
    assert!(
        failures.is_empty(),
        "conformance failures:\n{}",
        failures.join("\n")
    );
}

#[test]
fn invalid_vectors_are_rejected() {
    let docs = invalid_docs();
    assert!(!docs.is_empty(), "no invalid vectors found");
    let mut failures = Vec::new();
    for path in &docs {
        let src = fs::read_to_string(path).unwrap();
        let err = match CsonParser::new(&src).parse() {
            Ok(_) => {
                failures.push(format!(
                    "{}: expected rejection, but it parsed",
                    path.display()
                ));
                continue;
            }
            Err(e) => e,
        };
        let want_path = path.with_extension("error");
        let want = fs::read_to_string(&want_path)
            .unwrap_or_else(|e| panic!("missing {}: {e}", want_path.display()));
        if !err.to_lowercase().contains(&want.trim().to_lowercase()) {
            failures.push(format!(
                "{}: error {:?} did not contain {:?}",
                path.display(),
                err,
                want.trim()
            ));
        }
    }
    assert!(
        failures.is_empty(),
        "conformance failures:\n{}",
        failures.join("\n")
    );
}
