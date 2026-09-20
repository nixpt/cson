//! JSON projection — SPEC.md §6.
//!
//! One rule: a node with no metadata projects to its bare value; a node carrying
//! confidence or annotations projects to a wrapper object
//!
//! ```json
//! {"$value": …, "$confidence": …, "$annotations": [ … ]}
//! ```
//!
//! with the metadata members omitted when absent. The wrapper is keyed on the
//! NODE rather than on its parent's key, so it applies identically to object
//! values and array elements — an array element is a node (§5) and may carry
//! metadata like any other.
//!
//! This is distinct from [`CsonDocument::to_json`], which is a serde
//! serialization of the node model (round-trippable, but not the §6 shape).

use serde_json::{Map, Value};

use crate::{CsonDocument, CsonNode, CsonValue};

/// Error returned when a document cannot be projected.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProjectError {
    /// SPEC §6 reserves `$`-prefixed keys so a document key can never collide
    /// with a wrapper member.
    ReservedKey(String),
}

impl std::fmt::Display for ProjectError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProjectError::ReservedKey(k) => {
                write!(f, "Key {k:?} uses the reserved '$' prefix")
            }
        }
    }
}

impl std::error::Error for ProjectError {}

impl CsonDocument {
    /// Project this document to JSON per SPEC §6.
    pub fn project(&self) -> Result<Value, ProjectError> {
        project_node(&self.root)
    }
}

fn annotations_of(node: &CsonNode) -> Value {
    Value::Array(
        node.annotations
            .iter()
            .map(|a| {
                let mut m = Map::new();
                m.insert("name".into(), Value::String(a.name.clone()));
                m.insert(
                    "args".into(),
                    a.args.clone().map(Value::String).unwrap_or(Value::Null),
                );
                let mut props = Map::new();
                for (k, v) in &a.properties {
                    props.insert(k.clone(), Value::String(v.clone()));
                }
                m.insert("properties".into(), Value::Object(props));
                Value::Object(m)
            })
            .collect(),
    )
}

/// Bare value when the node carries no metadata, wrapper object otherwise.
fn wrap(node: &CsonNode, projected: Value) -> Value {
    if node.confidence.is_none() && node.annotations.is_empty() {
        return projected;
    }
    let mut m = Map::new();
    m.insert("$value".into(), projected);
    if let Some(c) = node.confidence {
        if let Some(n) = serde_json::Number::from_f64(c) {
            m.insert("$confidence".into(), Value::Number(n));
        }
    }
    if !node.annotations.is_empty() {
        m.insert("$annotations".into(), annotations_of(node));
    }
    Value::Object(m)
}

pub(crate) fn project_node(node: &CsonNode) -> Result<Value, ProjectError> {
    let value = match &node.value {
        CsonValue::String(s) => Value::String(s.clone()),
        CsonValue::Number(n) => serde_json::Number::from_f64(*n)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        CsonValue::Boolean(b) => Value::Bool(*b),
        CsonValue::Null => Value::Null,
        CsonValue::Synthesize(s) => {
            // an object, never a bare string, so it cannot be mistaken for data (§4.4)
            let mut m = Map::new();
            m.insert("$synthesize".into(), Value::String(s.clone()));
            Value::Object(m)
        }
        CsonValue::Array(items) => {
            let mut out = Vec::with_capacity(items.len());
            for item in items {
                out.push(project_node(item)?);
            }
            Value::Array(out)
        }
        CsonValue::Object(map) => {
            let mut out = Map::new();
            for (k, v) in map {
                // SPEC §6: a semantic key projects to its bare intent text — the
                // `~` marker is syntax, not data. (The internal map key keeps the
                // marker so the printer can round-trip it.)
                let key = k.strip_prefix('~').unwrap_or(k);
                if key.starts_with('$') {
                    return Err(ProjectError::ReservedKey(key.to_string()));
                }
                out.insert(key.to_string(), project_node(v)?);
            }
            Value::Object(out)
        }
    };
    Ok(wrap(node, value))
}
