# Query Syntax ABNF Specification

This document defines the **Augmented Backus–Naur Form (ABNF)** grammar for the SQL-like query syntax used in the `todo` CLI tool.

## Overview

The query syntax is a simplified SQL-like language for querying and manipulating task data stored in Markdown files. It supports selection, ordering, formatting, and output redirection operations.

## Core Grammar Rules

```abnf
; SELECT command
select-command = "select" SP filename [SP orderby-clause] [SP into-clause]

; Command components
filename = quoted-string / unquoted-filename
unquoted-filename = 1*(ALPHA / DIGIT / "." / "/" / "\" / "-" / "_")

orderby-clause = "orderby" SP sort-spec *("," SP sort-spec)
sort-spec = field-name [SP sort-direction]
field-name = identifier
sort-direction = "asc" / "desc"

into-clause = "into" SP filename

; Basic elements
identifier = (ALPHA / "_") *(ALPHA / DIGIT / "_" / "-")
quoted-string = DQUOTE *(%x20-21 / %x23-5B / %x5D-7E) DQUOTE  ; printable chars except "
SP = 1*(%x20 / %x09)  ; space or tab
ALPHA = %x41-5A / %x61-7A  ; A-Z / a-z
DIGIT = %x30-39  ; 0-9
DQUOTE = %x22  ; "

; Comments
comment = ";" *(%x20-7E)
```

## Semantic Rules

### Field Names
- Field names must be valid identifiers
- Common fields: `id`, `parent`, `title`, `priority`, `stakeholder`, `completed`, `skipped`, `due`, `weight`
- Custom fields are supported (any valid identifier)
- Special field `parent` is available for hierarchical sorting

### Sort Direction
- Default direction is `asc` (ascending) when not specified
- `desc` specifies descending order
- Undefined/null values sort first regardless of direction

### File Names
- Can be quoted or unquoted
- Quoted filenames support spaces and special characters
- Unquoted filenames must follow filesystem naming conventions
- Relative and absolute paths are supported

### Command Precedence
- Parameters can appear in any order after the filename
- `orderby` affects the sort order of results
- `into` redirects output to a file and preserves hierarchy

## Examples

### Valid Queries
```
todo select tasks.md
todo select tasks.md orderby priority desc
todo select tasks.md orderby priority asc, due desc
todo select "my tasks.md" orderby weight desc into sorted.md
todo select /path/to/tasks.md orderby parent, priority asc
```

### Error Conditions
- Missing filename: `todo select`
- Invalid sort direction: `todo select tasks.md orderby priority invalid`
- Non-existent file: Results in runtime error, not syntax error
- Invalid field names: Accepted syntactically, may result in undefined behavior

## Future Extensions
The syntax is designed to be extensible for future query capabilities:
- WHERE clauses for filtering
- Field selection (projection)
- Aggregation functions
- JOIN operations for multiple files