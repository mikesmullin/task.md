---GOOD
- A @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10
---BAD
- A @Alice #planning Prepare roadmap` due: 2025-10-05 weight: 10
---EXPLAINED
closing backtick with no matching opening backtick
---

---GOOD
- A @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10
---BAD
- A @Alice #planning `Prepare roadmap due: 2025-10-05 weight: 10
---EXPLAINED
backtick had no ending/closing
---

---GOOD
- A @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10
---BAD
- A @Alice #planning `Prepare roadmap` 2025-10-05 weight: 10
---EXPLAINED
values without keys are not allowed (except in task prefix shorthand)
---

---GOOD
- A @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10
---BAD
- A #planning `Prepare roadmap` due: 2025-10-05 weight: 10 @Alice
---EXPLAINED
@assignee tags are only allowed at beginning task prefix
---

---GOOD
- A @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10
---BAD
- A @Alice `Prepare roadmap` due: 2025-10-05 weight: 10 #planning
---EXPLAINED
#tags are only allowed at beginning task prefix
---

---GOOD
- A @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10
---BAD
- @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10 A
---EXPLAINED
priority shorthand are only allowed at beginning task prefix
---

---GOOD
- A @Alice #planning Prepare roadmap
---BAD
- A @Alice #planning Prepare roadmap due: 2025-10-05 weight: 10
---EXPLAINED
strings need to be quoted or the remainder of the line will be assumed to be the task title
---

---GOOD
- A @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10
  - B #backend `Refactor auth service` effort: 5h
---BAD
  - A @Alice #planning `Prepare roadmap` due: 2025-10-05 weight: 10
- B #backend `Refactor auth service` effort: 5h
---EXPLAINED
bullet hierarchy is not indented correctly; child exists without parent
---

---GOOD
- A @Alice #game
  title: `Plan "game engine" features`
  due: 2025-10-05
  weight: 10
  description: |
    Plan the architecture for the game engine:
      - ECS system
      - Rendering backend
      - Asset pipeline
---BAD
- A @Alice #game
  title: `Plan "game engine" features`
  due: 2025-10-05
  weight: 10
  description:
    Plan the architecture for the game engine:
      - ECS system
      - Rendering backend
      - Asset pipeline
---EXPLAINED
  multi-line string value indentation without pipe; unexpected lines appearing indented within task
---


