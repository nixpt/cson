package cson

import (
	"strconv"
	"strings"
)

func (c *cursor) parseValue() (any, *Error) {
	c.skipWS(true)
	ch := c.peek()
	if ch == 0 {
		return nil, c.err("Expected a value")
	}
	switch {
	case ch == '"':
		return c.parseString()
	case ch == '{':
		return c.parseObject()
	case ch == '[':
		return c.parseArray()
	case ch == '@':
		at := c.i
		if c.startsWith("@synthesize") {
			c.i += len("@synthesize")
			c.skipWS(true)
			if c.peek() != '(' {
				return nil, c.errAt("@synthesize needs a parenthesised description", at)
			}
			c.i++
			c.skipWS(true)
			desc, err := c.parseString()
			if err != nil {
				return nil, err
			}
			c.skipWS(true)
			if c.peek() != ')' {
				return nil, c.errAt("Unclosed @synthesize", at)
			}
			c.i++
			return &Synthesize{Description: desc}, nil
		}
		return nil, c.errAt("Unexpected annotation where a value was expected", at)
	}
	for _, kw := range []struct {
		word string
		val  any
	}{{"true", true}, {"false", false}, {"null", nil}} {
		if c.startsWith(kw.word) {
			var nxt byte
			if c.i+len(kw.word) < c.n {
				nxt = c.s[c.i+len(kw.word)]
			}
			isWord := (nxt >= 'a' && nxt <= 'z') || (nxt >= 'A' && nxt <= 'Z') ||
				(nxt >= '0' && nxt <= '9') || nxt == '_'
			if !isWord {
				c.i += len(kw.word)
				return kw.val, nil
			}
		}
	}
	if (ch >= '0' && ch <= '9') || ch == '+' || ch == '-' || ch == '.' {
		return c.parseNumber()
	}
	return nil, c.err("Unexpected character " + strconv.Quote(string(ch)) + " where a value was expected")
}

// parseNode implements: node := value (ws '~' number)? (ws annotation)*  — SPEC §3
func (c *cursor) parseNode(pending []Annotation) (*Node, *Error) {
	value, err := c.parseValue()
	if err != nil {
		return nil, err
	}
	n := &Node{Value: value, Annotations: append([]Annotation{}, pending...)}
	for {
		save := c.i
		c.skipWS(false)
		if c.peek() == '~' {
			// A node carries at most one confidence (SPEC §3). Without this the
			// second `~` falls through to key parsing and reports a misleading
			// "semantic key" error.
			if n.Confidence != nil {
				return nil, c.err("Duplicate confidence on a node")
			}
			at := c.i
			c.i++
			c.skipWS(false)
			conf, err := c.parseNumber()
			if err != nil {
				return nil, err
			}
			if conf < 0.0 || conf > 1.0 {
				return nil, c.errAt("Confidence "+strconv.FormatFloat(conf, 'g', -1, 64)+
					" outside [0.0, 1.0]", at)
			}
			n.Confidence = &conf
			continue
		}
		if c.peek() == '@' {
			ann, err := c.parseAnnotation()
			if err != nil {
				return nil, err
			}
			n.Annotations = append(n.Annotations, ann)
			continue
		}
		c.i = save
		return n, nil
	}
}

func (c *cursor) parseObject() (*Object, *Error) {
	openAt := c.i
	c.i++ // '{'
	out := NewObject()
	for {
		c.skipWS(true)
		if c.eof() {
			return nil, c.errAt("Unclosed object", openAt)
		}
		if c.peek() == '}' {
			c.i++
			return out, nil
		}
		key, semantic, err := c.parseKey()
		if err != nil {
			return nil, err
		}
		if out.Has(key) {
			return nil, c.err("Duplicate key " + strconv.Quote(key))
		}
		node, err := c.parseNode(nil)
		if err != nil {
			return nil, err
		}
		node.Semantic = semantic
		out.Set(key, node)
		c.skipWS(true)
		if c.peek() == ',' {
			c.i++ // trailing comma permitted
		}
	}
}

func (c *cursor) parseArray() ([]*Node, *Error) {
	openAt := c.i
	c.i++ // '['
	out := []*Node{}
	for {
		c.skipWS(true)
		if c.eof() {
			return nil, c.errAt("Unclosed array", openAt)
		}
		if c.peek() == ']' {
			c.i++
			return out, nil
		}
		// an array element is a NODE (§5) and may carry confidence and annotations
		node, err := c.parseNode(nil)
		if err != nil {
			return nil, err
		}
		out = append(out, node)
		c.skipWS(true)
		if c.peek() == ',' {
			c.i++
		}
	}
}

// parseKey implements: key := semantic_key | quoted_key | bare_key — SPEC §2.2
func (c *cursor) parseKey() (string, bool, *Error) {
	c.skipWS(true)
	var key string
	semantic := false
	switch {
	case c.peek() == '~':
		save := c.i
		c.i++
		c.skipWS(false)
		if c.peek() != '"' {
			c.i = save
			return "", false, c.err("A semantic key must be ~ followed by a quoted string")
		}
		k, err := c.parseString()
		if err != nil {
			return "", false, err
		}
		key, semantic = k, true
	case c.peek() == '"':
		k, err := c.parseString()
		if err != nil {
			return "", false, err
		}
		key = k
	default:
		start := c.i
		for c.i < c.n && c.s[c.i] != ':' && c.s[c.i] != '\n' {
			c.i++
		}
		key = strings.TrimSpace(c.s[start:c.i])
		if key == "" {
			return "", false, c.errAt("Expected a key", start)
		}
	}
	c.skipWS(false)
	if c.peek() != ':' {
		return "", false, c.err("Key " + strconv.Quote(key) + " must be followed by a colon")
	}
	c.i++
	return key, semantic, nil
}

// Parse parses a CSON document. On failure it returns an *Error carrying position.
func Parse(text string) (*Document, error) {
	c := &cursor{s: text, n: len(text)}
	root := NewObject()
	version := "1.0"
	var pending []Annotation
	var section *Object

	for {
		c.skipWS(true)
		if c.eof() {
			break
		}
		switch c.peek() {
		case '[': // section (§2.4)
			openAt := c.i
			c.i++
			j := strings.IndexByte(c.s[c.i:], ']')
			nl := strings.IndexByte(c.s[c.i:], '\n')
			if j < 0 || (nl >= 0 && nl < j) {
				return nil, c.errAt("Unclosed section", openAt)
			}
			name := strings.TrimSpace(c.s[c.i : c.i+j])
			c.i += j + 1
			if root.Has(name) {
				return nil, c.errAt("Duplicate key "+strconv.Quote(name), openAt)
			}
			section = NewObject()
			root.Set(name, &Node{Value: section})
			continue
		case '@':
			ann, err := c.parseAnnotation()
			if err != nil {
				return nil, err
			}
			if ann.Name == "cson" {
				// reserved for document metadata (§2.5): sets the version and
				// does NOT attach to the next node
				if v, ok := ann.Properties["version"]; ok && v != "" {
					version = v
				} else if ann.Args != nil && *ann.Args != "" {
					version = *ann.Args
				}
			} else {
				pending = append(pending, ann) // attaches to the NEXT node (§4.3)
			}
			continue
		}

		key, semantic, err := c.parseKey()
		if err != nil {
			return nil, err
		}
		target := root
		if section != nil {
			target = section
		}
		if target.Has(key) {
			return nil, c.err("Duplicate key " + strconv.Quote(key))
		}
		node, err := c.parseNode(pending)
		if err != nil {
			return nil, err
		}
		node.Semantic = semantic
		pending = nil
		target.Set(key, node)
	}
	return &Document{Root: root, Version: version}, nil
}
