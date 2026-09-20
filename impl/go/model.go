// Package cson implements CSON (Crush Semantic Object Notation) — a JSON-shaped
// configuration and serialization format with four AI-native primitives:
// semantic keys, confidence, annotations and synthesized values.
//
// Spec: https://github.com/nixpt/cson/blob/main/SPEC.md
//
// The package has no dependencies outside the standard library.
package cson

import "fmt"

// Error is a parse or projection failure, carrying position.
// SPEC §7 requires positional messages.
type Error struct {
	Reason string
	Line   int
	Col    int
}

func (e *Error) Error() string {
	return fmt.Sprintf("%s (line %d, column %d)", e.Reason, e.Line, e.Col)
}

// Annotation is `@name(args) { k: "v" }` — SPEC §4.3.
type Annotation struct {
	Name string
	// Args is nil when the annotation had no parenthesised arguments,
	// distinguishing `@wip` from `@wip()`.
	Args       *string
	Properties map[string]string
}

// Synthesize is `@synthesize("description")` — SPEC §4.4.
//
// An instruction, not data. Its own type so a consumer can never mistake it for
// a literal string; §6 projects it to {"$synthesize": …}.
type Synthesize struct {
	Description string
}

// Object preserves key order, which a Go map does not. Ordered keys matter for
// a printer (CSON-9) and make projections comparable across implementations.
type Object struct {
	keys  []string
	nodes map[string]*Node
}

// NewObject returns an empty ordered object.
func NewObject() *Object {
	return &Object{nodes: map[string]*Node{}}
}

// Set inserts or replaces a key, preserving first-insertion order.
func (o *Object) Set(key string, n *Node) {
	if _, ok := o.nodes[key]; !ok {
		o.keys = append(o.keys, key)
	}
	o.nodes[key] = n
}

// Get returns the node for key, and whether it was present.
func (o *Object) Get(key string) (*Node, bool) {
	n, ok := o.nodes[key]
	return n, ok
}

// Has reports whether key is present.
func (o *Object) Has(key string) bool {
	_, ok := o.nodes[key]
	return ok
}

// Keys returns the keys in insertion order.
func (o *Object) Keys() []string { return o.keys }

// Len returns the number of keys.
func (o *Object) Len() int { return len(o.keys) }

// Node is a value plus its metadata.
//
// Confidence is nil when unstated. SPEC §4.2 is explicit that absent is NOT the
// same as 1.0 — absent means "no claim" — so the two must stay distinguishable.
// Do not collapse nil to 1.0 anywhere.
type Node struct {
	// Value is one of: string, float64, bool, nil, *Synthesize, *Object, []*Node.
	Value       any
	Confidence  *float64
	Annotations []Annotation
	// Semantic reports whether the key was written ~"intent" (SPEC §4.1).
	Semantic bool
}

// Document is a parsed document: the root object plus its declared version
// (SPEC §2.5, §9).
type Document struct {
	Root    *Object
	Version string
}
