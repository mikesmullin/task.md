# todo CLI Agent Requirements

## Overview
`todo` is a human-friendly task management system using Markdown bullet lists as a **schemaless hierarchical database**. 

## Core Features
- Tasks stored as Markdown bullets; all non-bullet content ignored.
- Hierarchical tasks using **indentation for subtasks**.
- Prefix macros at the start of a task line:
  - `[x]` or `x` → `completed: true`
  - `[_]` → `completed: false` (optional, default when omitted)
  - `[-]` or `-` → `skipped: true`
  - `A-D` → priority (`A` highest, `D` lowest)
  - `@Name` → adds to `stakeholders` array
  - `#tag` → adds to `tags` array
- First quoted string on a task line automatically becomes `title` if `title:` key is missing.
- Key-value pairs are schemaless, supporting **any arbitrary key** (e.g., `weight`, `effort`, `category`).
- Multi-line fields using `|` pipe, indented lines following the key form the value.
- Deterministic **task IDs** (hash of initial content) that remain immutable.
- Implicit `parent` field for subtasks (calculated in memory; **never written** to file).
- Flattened queries in memory; hierarchical write-back preserves indentation.
- All tasks written under `## TODO` heading, replacing existing content or appending if missing.

## Task Syntax

### Single-Line Task Example

```
- [x] A @Alice @Bob #game `Plan engine` due: 2025-10-05 weight: 10
```

### Multi-Line Task Example

```
- [x] A @Alice @Bob #game
  title: `Plan "game engine" features`
  due: 2025-10-05
  weight: 10
  description: |
  Plan the architecture for the game engine:
  - ECS system
  - Rendering backend
  - Asset pipeline
  notes: |
  Review team document.
  Ensure compatibility with existing tools.

  - B #ecs
    title: `Design ECS system`
    due: 2025-10-06
    description: |
    Design an entity-component-system suitable
    for the engine.
```

## CLI Commands

### Query and Manipulate

```bash
todo query "SELECT [fields] FROM <file> [WHERE condition] [ORDER BY keys] [LIMIT n] [INTO <output>]"
todo query "UPDATE <file> SET key = 'value' WHERE condition"
todo query "DELETE FROM <file> WHERE condition"

# Find all tasks assigned to Alice
todo query "SELECT title, stakeholders FROM tasks.md WHERE stakeholders CONTAINS 'Alice'"

# Find high-priority tasks with #rpc tag
todo query "SELECT * FROM tasks.md WHERE priority = 'A' AND tags CONTAINS 'rpc'"
```

* SQL-like syntax for querying and manipulating tasks
* Supports field selection, filtering, sorting, limiting results, and file output
* Output formats: table (default) or JSON
* Writing to file preserves hierarchy under `## TODO`

### Linter / Validator

```bash
todo lint <file>
```

* `todo lint <file>` validates syntax and hierarchy.
* Rules:

  * Bullet lines start with `-`
  * Indentation consistent (2 spaces per level)
  * Valid prefix macros (`x`, `-`, `A-D`, `@name`, `#tag`)
  * First quoted string properly quoted
  * Key-value pairs in format `key: value`
  * Multi-line values properly indented under `|`
  * Unique IDs
* CLI **refuses operations on errors** to prevent data loss.

## Parsing Rules

1. Detect bullet lines: `-` indicates new task.
2. Prefix macros applied at start of line.
3. First quoted string becomes `title` if no `title:` key.
4. Key-value pairs parsed after prefixes.
5. Multi-line values using `|` consume all further indented lines.
6. Subtasks detected via additional indentation; parent field stored in memory.
7. Deterministic task ID generated based on initial task content.

## File Save Behavior

* Write all tasks under `## TODO` heading.
* Replace existing content under heading or append if missing.
* Subtasks always indented under parent.
* Calculated `parent` field **never written**.

## Query Syntax

* **SELECT**: Query tasks with optional field selection, filtering, sorting, limiting, and output
* **UPDATE**: Modify task fields based on conditions
* **DELETE**: Remove tasks matching conditions
* **WHERE**: Supports equality (`=`, `>`), boolean values, string matching, and `CONTAINS` for arrays/strings
* **ORDER BY**: Multiple keys with ASC/DESC direction
* **LIMIT**: Restrict the number of results returned
* **INTO**: Write results to a file while preserving hierarchy

## Output Formats

* **Table** (default): Markdown table format for human-readable display
* **JSON**: Structured data for programmatic use

## VS Code / Editor Integration

* Linter should provide real-time feedback.
* Highlight syntax errors, invalid prefixes, bad indentation.
* Optional language server for hover info, quick fixes.

## Node.js Implementation Notes

* ES6 modular syntax.
* Parser handles both single-line and multi-line tasks.
* Flattened queries in memory; hierarchical output on file write.
* Task serialization preserves indentation and multi-line blocks.
* CLI subcommands: query, lint, help.
