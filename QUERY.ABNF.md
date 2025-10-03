# Query Syntax ABNF Specification

This document defines the **Augmented Backus–Naur Form (ABNF)** grammar for the SQL-like query syntax used in the `todo` CLI tool, following [RFC 5234](https://tools.ietf.org/html/rfc5234).

## Overview

The query syntax is a simplified SQL-like language for querying and manipulating task data stored in Markdown files. It supports selection, filtering, ordering, limiting, and output redirection operations.

## Core Grammar Rules

```abnf
; Main query commands
query-command = select-command / update-command / delete-command

; SELECT command
select-command = "SELECT" SP select-fields SP "FROM" SP filename [SP where-clause] [SP orderby-clause] [SP limit-clause] [SP into-clause]

; UPDATE command
update-command = "UPDATE" SP filename SP "SET" SP assignment *("," SP assignment) [SP where-clause]

; DELETE command
delete-command = "DELETE" SP "FROM" SP filename [SP where-clause]

; Command components
select-fields = "*" / field-list
field-list = identifier *("," SP identifier)

assignment = identifier SP "=" SP value

where-clause = "WHERE" SP condition
condition = comparison / contains-condition / logical-condition
comparison = identifier SP comparison-op SP value
comparison-op = "=" / ">" / "<"

contains-condition = identifier SP "CONTAINS" SP value

logical-condition = condition SP logical-op SP condition
logical-op = "AND" / "OR"

orderby-clause = "ORDER" SP "BY" SP sort-spec *("," SP sort-spec)
sort-spec = identifier [SP sort-direction]
sort-direction = "ASC" / "DESC"

limit-clause = "LIMIT" SP number

into-clause = "INTO" SP filename

; Basic elements
identifier = (ALPHA / "_") *(ALPHA / DIGIT / "_" / "-")
value = quoted-string / number / boolean / "NULL"
quoted-string = DQUOTE *(%x20-21 / %x23-5B / %x5D-7E) DQUOTE  ; printable chars except "
number = 1*DIGIT ["." 1*DIGIT]
boolean = "true" / "false"
filename = quoted-string / unquoted-filename
unquoted-filename = 1*(ALPHA / DIGIT / "." / "/" / "\" / "-" / "_")

; Terminal symbols
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
- Common fields: `id`, `parent`, `title`, `priority`, `stakeholders`, `completed`, `skipped`, `due`, `weight`, `tags`
- `stakeholders` is an array field supporting multiple values
- `tags` is an array field supporting multiple values
- Custom fields are supported (any valid identifier)
- Special field `parent` is available for hierarchical sorting

### WHERE Conditions
- Supports comparison operators: `=`, `>`, `<`
- Supports `CONTAINS` operator for array and string matching
- Arrays (like `stakeholders`, `tags`) use `CONTAINS` to check membership
- Strings use `CONTAINS` to check substring presence
- Logical operators `AND`/`OR` for combining conditions
- Values can be strings, numbers, booleans, or NULL

### Sort Direction
- Default direction is `ASC` (ascending) when not specified
- `DESC` specifies descending order
- Undefined/null values sort first regardless of direction

### Field Selection
- `*` selects all fields
- Comma-separated field list for projection
- Array fields display as comma-separated values in table output

### UPDATE Operations
- `SET field = value` syntax for assignments
- Multiple assignments separated by commas
- WHERE clause filters which tasks to update

### DELETE Operations
- Removes tasks matching the WHERE condition
- Use with caution - operations are permanent

## Examples

### Valid Queries
```
; Select all fields
SELECT * FROM tasks.md

; Select specific fields
SELECT title, stakeholders, priority FROM tasks.md

; Filter with WHERE clause
SELECT * FROM tasks.md WHERE priority = 'A'

; Filter with CONTAINS
SELECT title FROM tasks.md WHERE stakeholders CONTAINS 'Alice'

; Complex WHERE conditions
SELECT * FROM tasks.md WHERE priority = 'A' AND stakeholders CONTAINS 'Bob'

; Sort results
SELECT * FROM tasks.md ORDER BY priority DESC, due ASC

; Limit results
SELECT * FROM tasks.md WHERE completed = false LIMIT 10

; Combined query
SELECT title, stakeholders FROM tasks.md WHERE stakeholders CONTAINS 'Alice' ORDER BY priority DESC LIMIT 5

; Output to file
SELECT * FROM tasks.md WHERE completed = true INTO completed-tasks.md

; Update tasks
UPDATE tasks.md SET completed = true WHERE stakeholders CONTAINS 'Alice'

; Delete tasks
DELETE FROM tasks.md WHERE completed = true AND priority = 'D'
```

### Error Conditions
- Missing FROM clause: `SELECT * WHERE condition`
- Invalid operators: `WHERE field INVALID 'value'`
- Mismatched quotes: `WHERE title = "unclosed`
- Non-existent files: Results in runtime error
- Invalid field names: Accepted syntactically, may result in undefined values

## Future Extensions
The syntax is designed to be extensible for future query capabilities:
- JOIN operations for multiple files
- Aggregation functions (COUNT, SUM, etc.)
- Subqueries and nested conditions
- More complex logical operators
- Regular expression matching in WHERE clauses