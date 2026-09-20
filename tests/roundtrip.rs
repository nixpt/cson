//! Round-trip property: `parse(print(doc))` must equal `doc` in MEANING.
//!
//! SPEC §6 claims a document is reconstructable from its projection plus the
//! printer. This is the test that makes the claim checkable.
//!
//! Equality is compared on the §6 projection rather than on the syntax, because
//! the printer deliberately does not preserve comments, `[section]` sugar, key
//! order or bare-vs-quoted key choice — none of which carry meaning.

use std::fs;
use std::path::{Path, PathBuf};

use cson::CsonParser;

fn corpus_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("conformance")
}

fn valid_docs() -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = fs::read_dir(corpus_dir().join("valid"))
        .expect("read valid/")
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|x| x == "cson"))
        .collect();
    v.sort();
    v
}

#[test]
fn print_then_parse_preserves_meaning() {
    let mut failures = Vec::new();
    for path in valid_docs() {
        let src = fs::read_to_string(&path).expect("read vector");
        let doc = match CsonParser::new(&src).parse() {
            Ok(d) => d,
            Err(e) => {
                failures.push(format!("{}: original failed to parse: {e}", path.display()));
                continue;
            }
        };
        let printed = doc.print();
        let reparsed = match CsonParser::new(&printed).parse() {
            Ok(d) => d,
            Err(e) => {
                failures.push(format!(
                    "{}: printed form failed to re-parse: {e}\n--- printed ---\n{printed}",
                    path.display()
                ));
                continue;
            }
        };
        let before = doc.project().expect("project original");
        let after = reparsed.project().expect("project reparsed");
        if before != after {
            failures.push(format!(
                "{}: meaning changed across print/parse\n  before: {before}\n  after:  {after}\n--- printed ---\n{printed}",
                path.display()
            ));
        }
        if doc.version != reparsed.version {
            failures.push(format!(
                "{}: version changed {} -> {}",
                path.display(),
                doc.version,
                reparsed.version
            ));
        }
    }
    assert!(failures.is_empty(), "round-trip failures:\n{}", failures.join("\n"));
}

/// SPEC §4.2: an absent confidence must not acquire one by being printed.
#[test]
fn printing_does_not_invent_confidence() {
    let doc = CsonParser::new("a: 1\nb: 1 ~1.0").parse().expect("parse");
    let printed = doc.print();
    assert!(
        !printed.contains("a: 1 ~"),
        "absent confidence must not be printed as ~1.0; got:\n{printed}"
    );
    let reparsed = CsonParser::new(&printed).parse().expect("re-parse");
    let root = match &reparsed.root.value {
        cson::CsonValue::Object(m) => m,
        _ => panic!("root is not an object"),
    };
    assert!(root["a"].confidence.is_none(), "absent confidence became {:?}", root["a"].confidence);
    assert_eq!(root["b"].confidence, Some(1.0), "explicit ~1.0 was lost");
}

/// A key that cannot be written bare must be quoted, not emitted raw.
#[test]
fn unsafe_keys_are_quoted() {
    let doc = CsonParser::new("\"two words\": 1\n\"has:colon\": 2").parse().expect("parse");
    let printed = doc.print();
    let reparsed = CsonParser::new(&printed).parse().expect("re-parse printed keys");
    assert_eq!(
        doc.project().unwrap(),
        reparsed.project().unwrap(),
        "quoted keys did not survive:\n{printed}"
    );
}

/// Annotations, semantic keys and synthesized values must survive.
#[test]
fn metadata_survives_round_trip() {
    let src = r#"~"billing issues": "route" ~0.9 @wip { owner: "foreman" } @urgent
accent: @synthesize("a colour")
nested: { x: [1 ~0.5, 2], y: "z" @note }
"#;
    let doc = CsonParser::new(src).parse().expect("parse");
    let printed = doc.print();
    let reparsed = CsonParser::new(&printed).parse().expect("re-parse");
    assert_eq!(
        doc.project().unwrap(),
        reparsed.project().unwrap(),
        "metadata lost across round trip:\n--- printed ---\n{printed}"
    );
}

/// The printer must emit STRICTLY valid CSON, not merely something our own
/// parsers accept.
///
/// Regression: nested-object pairs were once printed newline-separated with no
/// commas. That round-tripped fine, because every implementation here happens to
/// tolerate a missing comma — but the grammar (§5) is
/// `object = "{" [ pair { ws "," ws pair } [ ws "," ] ] "}"`, so a strict parser
/// would reject it. Round-trip tests cannot catch a bug the parser is lenient
/// about; this asserts the syntax directly.
#[test]
fn nested_object_pairs_are_comma_separated() {
    let doc = CsonParser::new("a: { x: 1, y: 2, z: 3 }").parse().expect("parse");
    let printed = doc.print();
    let commas = printed.matches(",\n").count();
    assert_eq!(
        commas, 2,
        "3 pairs need 2 separating commas; got {commas} in:\n{printed}"
    );
    assert!(
        !printed.contains("1\n  y"),
        "pairs must not be newline-separated without a comma:\n{printed}"
    );
}

/// Top-level pairs are newline-separated (`document = { pair }`), NOT comma-separated.
#[test]
fn document_pairs_are_not_comma_separated() {
    let doc = CsonParser::new("a: 1\nb: 2").parse().expect("parse");
    let printed = doc.print();
    assert!(
        !printed.contains(",\n"),
        "top-level pairs must not be comma-separated:\n{printed}"
    );
}
