# Example Document

This content should be ignored by the parser.

## TODO

# --- Single-Line Tasks ---

- A @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10
- B @Alice @Bob #backend `Refactor auth service` effort: 5h
- C `Unassigned title task with no prefixes`
- x `Completed item using x macro only`
- - `Skipped item with dash prefix`

# --- Prefix Combinations ---

- A @Bob #infra #urgent `Server migration` due: 2025-12-01
- x B @Carol #finance `Close Q4 budgets`
- D #loweffort @Dave `Water office plants`

# --- Explicit Title with Key ---

- title: `Write documentation` priority: B effort: 2h

# --- Multi-Line Tasks With Description ---

- A @Alice #game
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

# --- Nested Subtasks ---

- B @Eve #ecs `Design ECS system`
  description: |
    Design an entity-component-system suitable
    for the engine.
  - C #ecs `Define Components`
    - D `Investigate memory layout options`

# --- Key Without Title (Allowed) ---

- due: 2026-01-01 weight: 3 customField: foo

# --- Edge Cases ---

- A `Task with "escaped" quotes and \`backticks\`` tags: "cool"
- #tagonly `Tag prefix first, no other macros`
- @Frank `Stakeholder-only prefix`

# --- Multi-Line Without Title (Still Valid) ---

- x @Grace
  effort: 3h
  notes: |
    Forgot to add a title, but that's okay.
    Title will be undefined or null.
