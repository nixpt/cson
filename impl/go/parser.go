package cson

import (
	"strconv"
	"strings"
	"unicode"
)

// cursor walks the input by byte offset. Position is derived on demand rather
// than tracked, so the cursor stays cheap to rewind.
type cursor struct {
	s string
	i int
	n int
}

func (c *cursor) pos(at int) (line, col int) {
	line = 1 + strings.Count(c.s[:at], "\n")
	nl := strings.LastIndex(c.s[:at], "\n")
	return line, at - nl
}

func (c *cursor) errAt(msg string, at int) *Error {
	line, col := c.pos(at)
	return &Error{Reason: msg, Line: line, Col: col}
}

func (c *cursor) err(msg string) *Error { return c.errAt(msg, c.i) }

func (c *cursor) eof() bool { return c.i >= c.n }

func (c *cursor) peek() byte {
	if c.i < c.n {
		return c.s[c.i]
	}
	return 0
}

func (c *cursor) startsWith(p string) bool { return strings.HasPrefix(c.s[c.i:], p) }

// skipWS skips whitespace and comments. Whitespace is insignificant except
// inside strings; comments run `#` to end of line and may appear anywhere
// whitespace may (SPEC §2.1).
func (c *cursor) skipWS(newlines bool) {
	for c.i < c.n {
		switch ch := c.s[c.i]; {
		case ch == '#':
			if j := strings.IndexByte(c.s[c.i:], '\n'); j < 0 {
				c.i = c.n
			} else {
				c.i += j
			}
		case ch == '\n':
			if !newlines {
				return
			}
			c.i++
		case ch == ' ' || ch == '\t' || ch == '\r':
			c.i++
		default:
			return
		}
	}
}

var escapes = map[byte]string{
	'n': "\n", 't': "\t", 'r': "\r", 'b': "\b", 'f': "\f",
	'"': "\"", '\\': "\\", '/': "/",
}

func (c *cursor) parseString() (string, *Error) {
	start := c.i
	if c.peek() != '"' {
		return "", c.err("Expected a string")
	}
	c.i++
	var b strings.Builder
	for {
		if c.eof() {
			return "", c.errAt("Unclosed string", start)
		}
		ch := c.s[c.i]
		switch ch {
		case '"':
			c.i++
			return b.String(), nil
		case '\\':
			c.i++
			if c.eof() {
				return "", c.errAt("Unclosed string", start)
			}
			e := c.s[c.i]
			if e == 'u' {
				if c.i+5 > c.n {
					return "", c.err(`Truncated \u escape`)
				}
				r, err := strconv.ParseUint(c.s[c.i+1:c.i+5], 16, 32)
				if err != nil {
					return "", c.err(`Truncated \u escape`)
				}
				b.WriteRune(rune(r))
				c.i += 4
			} else if v, ok := escapes[e]; ok {
				b.WriteString(v)
			} else {
				b.WriteByte(e)
			}
			c.i++
		default:
			b.WriteByte(ch)
			c.i++
		}
	}
}

func (c *cursor) parseNumber() (float64, *Error) {
	start := c.i
	if c.peek() == '+' || c.peek() == '-' {
		c.i++
	}
	for c.i < c.n {
		ch := c.s[c.i]
		isNum := (ch >= '0' && ch <= '9') || ch == '.' || ch == 'e' || ch == 'E' || ch == '+' || ch == '-'
		if !isNum {
			break
		}
		// stop at a sign that is not part of an exponent
		if (ch == '+' || ch == '-') && !(c.s[c.i-1] == 'e' || c.s[c.i-1] == 'E') {
			break
		}
		c.i++
	}
	text := c.s[start:c.i]
	// SPEC §2.3: all numbers are IEEE-754 doubles
	v, err := strconv.ParseFloat(text, 64)
	if err != nil {
		return 0, c.errAt("Invalid number "+strconv.Quote(text), start)
	}
	return v, nil
}

func (c *cursor) parseBareProp() string {
	k := c.i
	for c.i < c.n && c.s[c.i] != ',' && c.s[c.i] != '}' && c.s[c.i] != '\n' {
		c.i++
	}
	return strings.TrimSpace(c.s[k:c.i])
}

func (c *cursor) parseAnnotation() (Annotation, *Error) {
	start := c.i
	c.i++ // '@'
	j := c.i
	for c.i < c.n {
		r := rune(c.s[c.i])
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '_' && r != '-' {
			break
		}
		c.i++
	}
	name := c.s[j:c.i]
	if name == "" {
		return Annotation{}, c.errAt("Annotation needs a name", start)
	}

	var args *string
	save := c.i
	c.skipWS(false)
	if c.peek() == '(' {
		openAt := c.i
		c.i++
		k := strings.IndexByte(c.s[c.i:], ')')
		if k < 0 {
			return Annotation{}, c.errAt("Unclosed annotation arguments", openAt)
		}
		a := strings.Trim(strings.TrimSpace(c.s[c.i:c.i+k]), `"`)
		args = &a
		c.i += k + 1
	} else {
		c.i = save
	}

	props := map[string]string{}
	save = c.i
	c.skipWS(false)
	if c.peek() == '{' {
		openAt := c.i
		c.i++
		for {
			c.skipWS(true)
			if c.eof() {
				return Annotation{}, c.errAt("Unclosed annotation properties", openAt)
			}
			if c.peek() == '}' {
				c.i++
				break
			}
			k := c.i
			for c.i < c.n && c.s[c.i] != ':' && c.s[c.i] != ',' && c.s[c.i] != '}' {
				c.i++
			}
			pname := strings.TrimSpace(c.s[k:c.i])
			if c.peek() != ':' {
				return Annotation{}, c.errAt("Malformed annotation property: expected a colon", k)
			}
			c.i++
			c.skipWS(true)
			if c.peek() == '"' {
				v, err := c.parseString()
				if err != nil {
					return Annotation{}, err
				}
				props[pname] = v
			} else {
				props[pname] = c.parseBareProp()
			}
			c.skipWS(true)
			if c.peek() == ',' {
				c.i++ // trailing comma permitted (§5)
			}
		}
	} else {
		c.i = save
	}
	return Annotation{Name: name, Args: args, Properties: props}, nil
}
