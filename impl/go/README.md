# cson — Go parser

A stdlib-only implementation of [CSON](../../SPEC.md) for Go.

```go
import cson "github.com/nixpt/cson/impl/go"

doc, err := cson.Parse(`temperature: 21.5 ~0.8 @source { by: "sensor-3" }`)
n, _ := doc.Root.Get("temperature")
n.Value          // 21.5
*n.Confidence    // 0.8   (nil when unstated — see below)
n.Annotations    // [{Name: "source", Args: nil, Properties: {"by": "sensor-3"}}]

data, _ := cson.Loads(`tags: ["a", "b"]`)   // map[string]any, ready for encoding/json
```

## Ordered keys

`*Object` preserves key order, which a Go map does not. Order matters for a printer
(CSON-9) and keeps projections comparable across implementations. `Project()` returns
`map[string]any` because that is what `encoding/json` consumers expect.

## Absent confidence is not 1.0

SPEC §4.2: absent means *no claim*, not certainty. `Node.Confidence` is a `*float64`
precisely so the two stay distinguishable — and the distinction survives into the
projection:

```go
cson.Loads("a: 1\nb: 1 ~1.0")
// map[a:1 b:map[$value:1 $confidence:1]]
```

A `float64` field defaulting to `0` would have silently destroyed this.

## Errors

Every rejection is an `*cson.Error` carrying `Line` and `Col` (SPEC §7):

```go
_, err := cson.Loads("a: 1\na: 2")
var e *cson.Error
errors.As(err, &e)   // e.Reason == `Duplicate key "a"`, e.Line == 2
```

## Tests

```bash
go test ./...          # 30 subtests: the corpus + spec behaviour
go run ./cmd/project f.cson   # print a document's §6 projection as JSON
```

`cmd/project` is what the repo-wide cross-check runs to compare Go's projection against
the other implementations.

## Status

16/16 conformance vectors, 14 spec tests (30 subtests total), and projections identical
to the Rust reference, Python and JavaScript on every vector.
