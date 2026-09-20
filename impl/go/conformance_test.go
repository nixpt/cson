package cson

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

const corpusDir = "../../conformance"

// canon renders a value with keys sorted and numbers normalised, so neither key
// order nor int/float rendering affects a comparison. SPEC §2.3 makes every
// number an IEEE-754 double; languages render them differently (Python emits
// 8080.0, Go and JS emit 8080), so compare values and not their spelling.
func canon(v any) string {
	switch t := v.(type) {
	case map[string]any:
		keys := make([]string, 0, len(t))
		for k := range t {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			parts = append(parts, fmt.Sprintf("%q:%s", k, canon(t[k])))
		}
		return "{" + strings.Join(parts, ",") + "}"
	case []any:
		parts := make([]string, 0, len(t))
		for _, e := range t {
			parts = append(parts, canon(e))
		}
		return "[" + strings.Join(parts, ",") + "]"
	case float64:
		if math.IsInf(t, 0) || math.IsNaN(t) {
			return fmt.Sprintf("#%v", t)
		}
		return fmt.Sprintf("#%.15e", t)
	case nil:
		return "null"
	default:
		b, _ := json.Marshal(t)
		return string(b)
	}
}

func TestValidVectors(t *testing.T) {
	dir := filepath.Join(corpusDir, "valid")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read %s: %v", dir, err)
	}
	n := 0
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".cson") {
			continue
		}
		stem := strings.TrimSuffix(e.Name(), ".cson")
		t.Run(stem, func(t *testing.T) {
			src, err := os.ReadFile(filepath.Join(dir, e.Name()))
			if err != nil {
				t.Fatal(err)
			}
			got, err := Loads(string(src))
			if err != nil {
				t.Fatalf("parse failed: %v", err)
			}
			raw, err := os.ReadFile(filepath.Join(dir, stem+".expected.json"))
			if err != nil {
				t.Fatal(err)
			}
			var want any
			if err := json.Unmarshal(raw, &want); err != nil {
				t.Fatal(err)
			}
			if canon(got) != canon(want) {
				t.Errorf("projection mismatch\n  got  %s\n  want %s", canon(got), canon(want))
			}
		})
		n++
	}
	if n == 0 {
		t.Fatal("no valid vectors found — is the corpus path right?")
	}
}

func TestInvalidVectors(t *testing.T) {
	dir := filepath.Join(corpusDir, "invalid")
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read %s: %v", dir, err)
	}
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".cson") {
			continue
		}
		stem := strings.TrimSuffix(e.Name(), ".cson")
		t.Run(stem, func(t *testing.T) {
			src, err := os.ReadFile(filepath.Join(dir, e.Name()))
			if err != nil {
				t.Fatal(err)
			}
			needle, err := os.ReadFile(filepath.Join(dir, stem+".error"))
			if err != nil {
				t.Fatal(err)
			}
			want := strings.TrimSpace(string(needle))
			_, err = Loads(string(src))
			if err == nil {
				t.Fatalf("parsed but MUST be rejected (error should contain %q)", want)
			}
			if _, ok := err.(*Error); !ok {
				t.Fatalf("returned %T, not *cson.Error: %v", err, err)
			}
			if !strings.Contains(strings.ToLower(err.Error()), strings.ToLower(want)) {
				t.Errorf("error %q lacks %q", err.Error(), want)
			}
		})
	}
}
