# todo CLI Agent Requirements

## Overview
`todo` is a human-friendly task management system using Markdown bullet lists as a **schemaless hierarchical database**. 

Version Three adds support for **multi-line tasks** with YAML-style syntax for long descriptions and notes. The CLI provides **SQL-like queries**, ordering, and safe file writes under a `## TODO` heading.

## Core Features
- Tasks stored as Markdown bullets; all non-bullet content ignored.
- Hierarchical tasks using **indentation for subtasks**.
- Prefix macros at the start of a task line:
  - `x` → `completed: true`
  - `-` → `skipped: true`
  - `A-D` → priority (`A` highest, `D` lowest)
  - `@Name` → `stakeholder: "Name"`
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

* x A @Alice #game `Plan engine` due: 2025-10-05 weight: 10

```

### Multi-Line Task Example
```

* x A @Alice #game
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

  * B #ecs
    title: `Design ECS system`
    due: 2025-10-06
    description: |
    Design an entity-component-system suitable
    for the engine.

````

## CLI Commands

### Select and Query
```bash
todo select <file> [orderby <key1 [asc|desc], key2 ...>]
todo select <file> orderby <keys> into <output_file>
````

* Flattened queries; optionally sort by any key including `parent`.
* Writing to file preserves hierarchy under `## TODO`.

### Planned CRUD Commands

```bash
todo insert <file> key: value ...
todo update <file> set key=value where id=<id>
todo delete <file> where id=<id>
```

* `id` can be full or short hash prefix.

### Linter / Validator

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

## Sorting / OrderBy

* Multiple keys allowed: `orderby priority desc, due asc, weight desc`
* Parent field can be used to group subtasks.

## VS Code / Editor Integration

* Linter should provide real-time feedback.
* Highlight syntax errors, invalid prefixes, bad indentation.
* Optional language server for hover info, quick fixes.

## Node.js Implementation Notes

* ES6 modular syntax.
* Parser handles both single-line and multi-line tasks.
* Flattened queries in memory; hierarchical output on file write.
* Task serialization preserves indentation and multi-line blocks.
* CLI commands: select, orderby, into, lint (full CRUD later).
