package cson

import (
	"strings"
	"testing"
)

// Spec behaviour the conformance corpus does not fully pin down — the places an
// implementation can diverge while still passing every vector.

func mustParse(t *testing.T, s string) *Document {
	t.Helper()
	d, err := Parse(s)
	if err != nil {
		t.Fatalf("parse %q: %v", s, err)
	}
	return d
}

// SPEC §4.2: absent confidence is "no claim", NOT 1.0.
func TestAbsentConfidenceIsNotOne(t *testing.T) {
	d := mustParse(t, "a: 1\nb: 1 ~1.0")
	a, _ := d.Root.Get("a")
	b, _ := d.Root.Get("b")
	if a.Confidence != nil {
		t.Errorf("unstated confidence should be nil, got %v", *a.Confidence)
	}
	if b.Confidence == nil || *b.Confidence != 1.0 {
		t.Errorf("explicit ~1.0 should be 1.0, got %v", b.Confidence)
	}
	got, err := Loads("a: 1\nb: 1 ~1.0")
	if err != nil {
		t.Fatal(err)
	}
	// the distinction must survive into the projection
	if _, wrapped := got["b"].(map[string]any); !wrapped {
		t.Errorf("explicit confidence should project to a wrapper, got %T", got["b"])
	}
	if _, wrapped := got["a"].(map[string]any); wrapped {
		t.Errorf("absent confidence should project to a bare value, got a wrapper")
	}
}

func TestSemanticKeys(t *testing.T) {
	d := mustParse(t, "~\"billing issues\": \"route\"\nplain: \"x\"")
	s, ok := d.Root.Get("billing issues")
	if !ok || !s.Semantic {
		t.Error("semantic key should be flagged and keyed by its intent text")
	}
	p, _ := d.Root.Get("plain")
	if p.Semantic {
		t.Error("bare key should not be flagged semantic")
	}
}

func TestAnnotations(t *testing.T) {
	d := mustParse(t, `port: 8080 @wip { owner: "foreman" } @urgent`)
	n, _ := d.Root.Get("port")
	if len(n.Annotations) != 2 || n.Annotations[0].Name != "wip" || n.Annotations[1].Name != "urgent" {
		t.Fatalf("stacked annotations wrong: %+v", n.Annotations)
	}
	if n.Annotations[0].Properties["owner"] != "foreman" {
		t.Errorf("annotation properties wrong: %+v", n.Annotations[0].Properties)
	}
	// a pending annotation attaches to the FOLLOWING node (§4.3)
	d = mustParse(t, "@pending\nkey: \"v\"")
	k, _ := d.Root.Get("key")
	if len(k.Annotations) != 1 || k.Annotations[0].Name != "pending" {
		t.Errorf("pending annotation should attach to the next node: %+v", k.Annotations)
	}
	// @cson is document metadata (§2.5), NOT an annotation on the next node
	d = mustParse(t, `@cson { version: "1.1" }`+"\nk: 1")
	k, _ = d.Root.Get("k")
	if len(k.Annotations) != 0 {
		t.Errorf("@cson must not attach to the next node: %+v", k.Annotations)
	}
	if d.Version != "1.1" {
		t.Errorf("version should be 1.1, got %q", d.Version)
	}
	if got := mustParse(t, `@cson("2.0")`+"\nk: 1").Version; got != "2.0" {
		t.Errorf("args form version should be 2.0, got %q", got)
	}
}

func TestArrayElementMetadata(t *testing.T) {
	// an array element is a node (§5) and may carry metadata
	got, err := Loads("a: [1 ~0.5, 2]")
	if err != nil {
		t.Fatal(err)
	}
	arr := got["a"].([]any)
	if _, wrapped := arr[0].(map[string]any); !wrapped {
		t.Errorf("array element with confidence should wrap, got %T", arr[0])
	}
	if _, wrapped := arr[1].(map[string]any); wrapped {
		t.Errorf("array element without metadata should be bare, got a wrapper")
	}
}

func TestErrorsArePositional(t *testing.T) {
	cases := []struct{ name, src, needle string }{
		{"duplicate key", "a: 1\na: 2", "Duplicate key"},
		{"confidence high", "a: 1 ~1.5", "outside"},
		{"confidence low", "a: 1 ~-0.5", "outside"},
		{"missing colon", "port 8080", "colon"},
		{"unclosed object", "x: { a: 1", "Unclosed"},
		{"unclosed string", `x: "abc`, "Unclosed string"},
		{"unclosed synthesize", `x: @synthesize("no close"`, "Unclosed"},
		{"unclosed section", "[unclosed\nx: 1", "Unclosed section"},
		{"reserved key", "$value: 1", "reserved"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := Loads(c.src)
			if err == nil {
				t.Fatalf("expected rejection of %q", c.src)
			}
			if !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(c.needle)) {
				t.Errorf("error %q lacks %q", err.Error(), c.needle)
			}
		})
	}
	_, err := Loads("a: 1\na: 2")
	if e, ok := err.(*Error); !ok || e.Line != 2 {
		t.Errorf("duplicate-key error should report line 2, got %v", err)
	}
}

func TestLexical(t *testing.T) {
	for _, c := range []struct{ name, src string }{
		{"comments", "# lead\na: 1  # trail\n"},
		{"trailing comma object", "a: { x: 1, }"},
		{"trailing comma array", "a: [1, 2, ]"},
		{"nested", "a: { b: { c: [1] } }"},
		{"escapes", `a: "x\ny\"z"`},
	} {
		t.Run(c.name, func(t *testing.T) {
			if _, err := Loads(c.src); err != nil {
				t.Errorf("should parse: %v", err)
			}
		})
	}
}

func TestOrderedKeys(t *testing.T) {
	d := mustParse(t, "z: 1\na: 2\nm: 3")
	want := []string{"z", "a", "m"}
	got := d.Root.Keys()
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("key order not preserved: got %v want %v", got, want)
		}
	}
}
