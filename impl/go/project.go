package cson

import "strings"

// reservedPrefix marks the wrapper members; SPEC §6 reserves it so a document
// key can never collide with $value / $confidence / $annotations / $synthesize.
const reservedPrefix = "$"

// Project returns the SPEC §6 JSON projection of the document.
//
// One rule: a node with no metadata projects to its bare value; a node carrying
// confidence or annotations projects to a wrapper object
//
//	{"$value": …, "$confidence": …, "$annotations": [ … ]}
//
// with the metadata members omitted when absent. Because the wrapper is keyed on
// the NODE and not on its parent's key, it applies identically to object values
// and array elements — an array element is a node and may carry metadata.
//
// This keeps absent confidence distinguishable from an explicit ~1.0 (§4.2): the
// $confidence member is present only when stated.
//
// Objects project to map[string]any, so callers can hand the result straight to
// encoding/json. Key order is not preserved by a Go map; the ordered keys live on
// *Object for a printer to use.
func (d *Document) Project() (map[string]any, error) {
	return projectObject(d.Root)
}

func annotationsOf(n *Node) []any {
	out := make([]any, 0, len(n.Annotations))
	for _, a := range n.Annotations {
		var args any
		if a.Args != nil {
			args = *a.Args
		}
		props := map[string]any{}
		for k, v := range a.Properties {
			props[k] = v
		}
		out = append(out, map[string]any{"name": a.Name, "args": args, "properties": props})
	}
	return out
}

// wrap returns the bare value when the node carries no metadata, a wrapper otherwise.
func wrap(n *Node, projected any) any {
	if n.Confidence == nil && len(n.Annotations) == 0 {
		return projected
	}
	out := map[string]any{"$value": projected}
	if n.Confidence != nil {
		out["$confidence"] = *n.Confidence
	}
	if len(n.Annotations) > 0 {
		out["$annotations"] = annotationsOf(n)
	}
	return out
}

func projectValue(v any) (any, error) {
	switch t := v.(type) {
	case *Synthesize:
		// an object, never a bare string, so it cannot be mistaken for data (§4.4)
		return map[string]any{"$synthesize": t.Description}, nil
	case *Object:
		return projectObject(t)
	case []*Node:
		out := make([]any, 0, len(t))
		for _, n := range t {
			pv, err := projectNode(n)
			if err != nil {
				return nil, err
			}
			out = append(out, pv)
		}
		return out, nil
	default:
		return v, nil
	}
}

func projectNode(n *Node) (any, error) {
	pv, err := projectValue(n.Value)
	if err != nil {
		return nil, err
	}
	return wrap(n, pv), nil
}

func projectObject(o *Object) (map[string]any, error) {
	out := make(map[string]any, o.Len())
	for _, k := range o.Keys() {
		if strings.HasPrefix(k, reservedPrefix) {
			return nil, &Error{Reason: "Key \"" + k + "\" uses the reserved '$' prefix"}
		}
		n, _ := o.Get(k)
		pv, err := projectNode(n)
		if err != nil {
			return nil, err
		}
		out[k] = pv
	}
	return out, nil
}

// Loads parses text and returns its SPEC §6 projection.
func Loads(text string) (map[string]any, error) {
	doc, err := Parse(text)
	if err != nil {
		return nil, err
	}
	return doc.Project()
}
