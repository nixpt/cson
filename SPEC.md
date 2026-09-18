# CSON — specification

**Crush Semantic Object Notation** — a human-readable configuration and
serialization format that blends JSON structure with AI-native primitives:
confidence weights, semantic keys, annotations, and synthesized values.

- **Format version:** `1.0` (the `@cson { version: "1.0" }` default)
- **Status:** draft — grammar stable, conformance corpus growing
- **License:** spec + reference implementation MIT OR Apache-2.0

This document is **language-agnostic**. It defines the format; a *parser* is an
implementation of it. The Rust reference parser lives in this repository
(`src/`); other languages are expected to ship their own (`cson-py`, …).

---

## 1. Design goals

1. **JSON-compatible shape, AI-native values.** A CSON document is an object of
   key/value nodes, like JSON — plus four primitives JSON lacks.
2. **Human-editable.** Comments, optional trailing commas, bare keys, and
   whitespace-insensitive structure.
3. **Lossless to JSON.** Every CSON node has a defined JSON projection
   (§6), so a CSON document can be consumed by any JSON tooling.
4. **Confidence is first-class.** A value may carry a probability, because an
   agent-generated document should be able to say *how sure it is*.

The four primitives, and what each is for:

| Primitive | Syntax | Purpose |
|---|---|---|
| **Semantic key** | `~"intent text": value` | A fuzzy-match anchor — the key means *this intent*, not an exact string |
| **Confidence** | `value ~0.95` | How sure the producer is of this node |
| **Annotation** | `@name(args) { k: v }` | Metadata attached to a node or document (provenance, status, rationale) |
| **Synthesized value** | `@synthesize("description")` | A placeholder: the value is to be *generated* to satisfy the description |

---

## 2. Lexical structure

### 2.1 Whitespace and comments

Whitespace is insignificant except inside strings. Comments run from `#` to end
of line and may appear anywhere whitespace may.

```
# a whole-line comment
key: "value"   # a trailing comment
```

### 2.2 Keys

A key is one of:

- **Bare key** — a run of characters up to the first `:`, whitespace-trimmed.
  `name: "x"`, `a-key: 1`
- **Quoted key** — a double-quoted string. `"two words": 1`
- **Semantic key** — `~` immediately followed by a double-quoted string.
  `~"billing or refund issues": handler` (see §4.1)

A key must be followed by `:`.

### 2.3 Values

A value is one of:

| Form | Example |
|---|---|
| String | `"hello"` |
| Number | `42`, `3.14` (all numbers are IEEE-754 doubles) |
| Boolean | `true`, `false` |
| Null | `null` |
| Object | `{ a: 1, b: 2 }` |
| Array | `[1, 2, 3]` |
| Synthesized | `@synthesize("a complimentary color")` |

### 2.4 Sections

A bare `[name]` on its own line opens a **section**: all following key/value
pairs until the next section belong to a nested object under `name`. Sections
are sugar for nesting — `[a]` + `x: 1` ⇔ `a: { x: 1 }`.

### 2.5 Document version

`@cson { version: "1.0" }` (or `@cson("1.0")`) sets the document's version.
Absent, the version is `1.0`.

---

## 3. Node model

A **node** is a value plus optional metadata:

```
node      := value (confidence)? (annotation)*
value     := string | number | boolean | null | object | array | synthesize
confidence:= "~" number          # 0.0 … 1.0
annotation:= "@" name ( "(" args ")" )? ( "{" props "}" )?
```

This is the unit of the format: unlike JSON, a *value* and its metadata travel
together. A parser produces a tree of nodes rooted in a document object.

**Duplicate keys are an error** (same as JSON). A parser must reject them.

---

## 4. The primitives

### 4.1 Semantic keys

```cson
~"billing or refund issues": "route to support"
```

A semantic key carries **intent**, not an exact name. The key's meaning is the
described intent; a consumer that fuzzy-matches keys (an LLM, an embedding
index) uses the text. An exact-match consumer treats the text as the key.

### 4.2 Confidence

```cson
temperature: 21.5 ~0.8
```

A confidence of `0.8` on a value means "the producer believes this is right
with probability ≈0.8". Range is `[0.0, 1.0]`; absent means *unstated* (which is
**not** the same as `1.0` — it is "no claim"). Parsers must preserve the
distinction between absent and `1.0`.

### 4.3 Annotations

```cson
port: 8080 @wip { owner: "foreman" }
host: "localhost" @temporary
model: "x" @cson("1.5")        # args form
```

An annotation has a name, optional parenthesized **args** (a raw string), and
optional `{ key: value }` **properties** (string values). Multiple annotations
may stack. `@cson` is reserved for document metadata (§2.5).

Annotations attach to the **next node** in a document (a pending annotation is
applied to the following key/value pair), or to a value inline.

### 4.4 Synthesized values

```cson
accent: @synthesize("a complimentary color to #3366cc")
```

A **synthesized value** is an instruction, not data: the value should be
generated to satisfy the description. A consumer that cannot synthesize must
surface it as *unresolved*, never as a literal string (see §6).

---

## 5. Grammar (EBNF)

```ebnf
document     = { annotation | section | pair | comment } ;
section      = "[" ws name ws "]" ;
pair         = key ws ":" ws node ;
key          = semantic_key | quoted_key | bare_key ;
semantic_key = "~" ws quoted_string ;
quoted_key   = quoted_string ;
bare_key     = { ? any char except ':' and newline ? } ;

node         = value { ws "~" ws number } { ws annotation } ;
value        = string | number | boolean | null | object | array | synthesize ;
object       = "{" ws [ pair { ws "," ws pair } [ ws "," ] ws ] "}" ;
array        = "[" ws [ node { ws "," ws node } [ ws "," ] ws ] "]" ;
synthesize   = "@synthesize" ws "(" ws quoted_string ws ")" ;

annotation   = "@" name [ ws "(" args ")" ] [ ws "{" ws props ws "}" ] ;
props        = prop { ws "," ws prop } [ ws "," ] ;
prop         = name ws ":" ws string ;
```

Trailing commas are permitted in objects, arrays, and annotation properties.
Comments (`# … EOL`) may appear anywhere whitespace is allowed.

---

## 6. JSON projection

Every CSON document maps to JSON so existing tooling can consume it:

- **Node value** → its JSON equivalent. Objects recurse; arrays recurse.
- **Confidence** → a sibling key `"<key>$confidence": 0.95`, omitted when absent.
- **Annotations** → a sibling key `"<key>$annotations": [ { "name": …, "args": …, "properties": … } ]`, omitted when empty.
- **Semantic key** → the key's text, verbatim (the `~` is not part of the data).
- **Synthesized value** → `{ "$synthesize": "the description" }` (an object, so
  it is never confused with a literal string).

The projection is **lossy in syntax, lossless in meaning**: a CSON parser can
reconstruct a document from its projection plus the CSON printer.

> The Rust reference parser's `to_json` / `from_json` implement this projection
> today for values and annotations; the `$confidence` / `$annotations` sibling
> convention above is the specified target shape and is tracked as a
> conformance item (see `conformance/`).

---

## 7. Errors

A conforming parser must reject, with a positional message:

- an unclosed object, array, annotation, section, or string;
- a duplicate key;
- a confidence outside `[0.0, 1.0]`;
- a key with no following `:`;
- a malformed annotation property.

---

## 8. Conformance

An implementation is *conforming* if it passes every vector in
[`conformance/`](conformance/). The corpus is language-neutral: each vector is an
input document plus its expected parse result (or expected error). Run it from
any language.

Adding a primitive or changing the grammar is a **spec change**: bump the format
version, add vectors, and update every parser. Parsers must not diverge from the
corpus.

---

## 9. Versioning

The format version is the string in `@cson { version: … }`. `1.0` is the current
draft. A change that alters the meaning of an existing document is a breaking
change and requires a new major version; additive primitives may bump the minor
version. A parser must surface the document's declared version to its caller.
