# Task Syntax ABNF Specification

This document defines the **Augmented Backus–Naur Form (ABNF)** grammar for the proprietary task syntax used in the `todo` CLI tool, following [RFC 5234](https://tools.ietf.org/html/rfc5234).

## Overview

The task syntax is embedded within Markdown files under a `## TODO` heading. Tasks are represented as hierarchical bullet lists with prefix macros, optional titles, and key-value pairs supporting both single-line and multi-line values.

## Core Grammar Rules

```abnf
; Top-level document structure
todo-document = *markdown-content todo-section *markdown-content

todo-section = todo-heading CRLF *empty-line *task-item

todo-heading = "##" 1*SP "TODO" [1*SP]

; Task structure
task-item = task-line *continuation-line

task-line = indent bullet-marker SP task-content [comment]

continuation-line = key-value-line / multiline-content-line

; Basic structural elements
indent = *(2SP)  ; Indentation in multiples of 2 spaces
bullet-marker = "-"
comment = SP ";" *non-crlf

; Task content parsing
task-content = [prefix-section] [title-section] [inline-kv-section]

prefix-section = *prefix-token

title-section = quoted-string / unquoted-title

inline-kv-section = *(SP key-value-pair)

; Prefix tokens (must appear at start of task content)
prefix-token = (priority-token / completion-token / skip-token / stakeholder-token / tag-token) [SP]

priority-token = "A" / "B" / "C" / "D"
completion-token = "x" / "[x]"
skip-token = "-" / "[-]"
incomplete-token = "[_]"
stakeholder-token = "@" identifier
tag-token = "#" identifier

; Title specifications
quoted-string = backtick-string / double-quote-string / single-quote-string

backtick-string = "`" *backtick-char "`"
backtick-char = %x01-5F / %x61-10FFFF  ; Any char except backtick (0x60)
              / "\`"                     ; Escaped backtick

double-quote-string = DQUOTE *dquote-char DQUOTE
dquote-char = %x01-21 / %x23-10FFFF     ; Any char except quote (0x22)
            / "\" DQUOTE                 ; Escaped quote

single-quote-string = "'" *squote-char "'"
squote-char = %x01-26 / %x28-10FFFF     ; Any char except quote (0x27)
            / "\'"                       ; Escaped quote

unquoted-title = 1*title-char
title-char = %x21-10FFFF                ; Any printable char
           - (":" / "`" / DQUOTE / "'")  ; Except reserved chars

; Key-value pairs
key-value-pair = key ":" [SP] value

key-value-line = indent-plus key ":" [SP] (simple-value / multiline-marker)

key = identifier

identifier = ALPHA *(ALPHA / DIGIT / "_" / "-")

; Value specifications
value = simple-value / multiline-value

simple-value = quoted-string / unquoted-value

unquoted-value = 1*value-char
value-char = %x21-10FFFF - (SP / CRLF)  ; Any non-whitespace, non-newline

multiline-marker = "|"
multiline-value = multiline-marker CRLF *multiline-content-line

multiline-content-line = indent-plus-plus *non-crlf CRLF

; Indentation rules
indent-plus = indent 2SP              ; One level deeper than task
indent-plus-plus = indent-plus 2SP    ; Two levels deeper (for multiline content)

; Basic character classes and utilities
empty-line = [SP] CRLF
markdown-content = *non-crlf CRLF     ; Any line not matching task syntax
non-crlf = %x01-09 / %x0B-0C / %x0E-10FFFF

; Standard ABNF core rules (RFC 5234)
ALPHA = %x41-5A / %x61-7A             ; A-Z / a-z
DIGIT = %x30-39                       ; 0-9
DQUOTE = %x22                         ; " (quotation mark)
SP = %x20                             ; space
CRLF = %x0D %x0A / %x0A               ; carriage return + line feed OR line feed
```

## Semantic Rules

Beyond the syntactic grammar, the following semantic rules apply:

### 1. Prefix Token Ordering
Prefix tokens must appear in this order when multiple are present:
1. Priority (`A`, `B`, `C`, `D`)
2. Completion/Skip (`[x]`, `x`, `[-]`, `-`, `[_]`) 
3. Stakeholders (`@name1`, `@name2`, ...)
4. Tags (`#tag1`, `#tag2`, ...)

### 2. Title Resolution
- If a `title:` key is explicitly provided, it takes precedence
- Otherwise, the first quoted string becomes the implicit title
- Unquoted titles are only valid if no key-value pairs follow them

### 3. Key-Value Semantics
- Keys must be valid identifiers matching `[A-Za-z_][A-Za-z0-9_-]*`
- Values can be:
  - Quoted strings (preserving internal whitespace and special characters)
  - Unquoted values (no spaces, limited special characters)
  - Multi-line values (using `|` pipe notation with proper indentation)

### 4. Hierarchical Structure
- Child tasks must be indented exactly 2 spaces more than their parent
- The hierarchy is determined by indentation level
- Parent-child relationships are implicit and computed, never stored

### 5. Special Value Processing
- Empty values are allowed: `key:`
- Boolean interpretation: `completed: true`, `skipped: true` for prefix macros
- Checkbox syntax: `[x]` for completed, `[-]` for skipped, `[_]` for incomplete (optional)
- Single-char aliases: `x` and `-` still supported for backward compatibility
- Arrays: Multiple `#tag` prefixes create a `tags` array
- Arrays: Multiple `@name` prefixes create a `stakeholders` array
- Custom fields: Any key not in the standard set is preserved as-is

## Examples

### Simple Task
```
- A @Alice @Bob #urgent "Fix login bug" due: 2025-10-01
```

**Parsed as:**
- Priority: A
- Stakeholders: ["Alice", "Bob"]
- Tags: ["urgent"]
- Title: "Fix login bug"
- Due: 2025-10-01

### Checkbox Syntax Task
```
- [x] B @Carol #finance "Close Q4 budgets"
```

**Parsed as:**
- Completed: true
- Priority: B
- Stakeholders: ["Carol"]
- Tags: ["finance"]
- Title: "Close Q4 budgets"

### Multi-line Task
```
- B @Bob @Dave #backend
  title: "Refactor authentication system"
  description: |
    Complete rewrite of the auth module:
    - Update password hashing
    - Implement 2FA support
    - Add session management
  effort: 5d
```

**Parsed as:**
- Priority: B
- Stakeholders: ["Bob", "Dave"]
- Tags: ["backend"]
- Title: "Refactor authentication system"
- Description: (multi-line content)
- Effort: 5d

### Task Hierarchy
```
- A "Parent task"
  - B "Child task one"
    - C "Grandchild task"
  - B "Child task two"
```

## Error Conditions

The following conditions are considered syntax errors:

1. **Misplaced Prefix Tokens**: Prefix tokens appearing after title or key-value pairs
2. **Unmatched Quotes**: Unclosed quoted strings
3. **Invalid Hierarchy**: Child tasks without proper parent indentation
4. **Orphaned Values**: Values appearing without associated keys
5. **Multi-line Without Pipe**: Indented content under a key without `|` marker
6. **Invalid Indentation**: Indentation not in multiples of 2 spaces

## Notes

- This grammar describes the **syntactic structure** only
- **Semantic processing** (ID generation, parent relationships, etc.) occurs after parsing
- The syntax is **schemaless** - any key-value pairs are allowed
- **Markdown compatibility** is maintained - tasks exist within standard Markdown bullet lists
- **Whitespace sensitivity** applies to indentation but not to spacing around operators
