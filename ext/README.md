# Todo Task Language Support for VS Code

A VS Code extension that provides real-time linting and language support for `*.task.md` files using the todo CLI's linting logic.

## Features

- **Real-time linting**: Get instant feedback on syntax errors and warnings as you type
- **Syntax highlighting**: Proper highlighting for task syntax including priorities, stakeholders, tags, and key-value pairs
- **Auto-completion**: Intelligent suggestions for common task properties and prefix tokens
- **Hover information**: Get details about prefix tokens and task elements
- **Configurable**: Customize linting behavior, indentation size, and warning display

## Syntax Overview

This extension supports the todo CLI task syntax:

### Task Structure
```markdown
## TODO

- A @Alice #urgent "Fix authentication bug" due: 2025-10-01 weight: 10
  description: |
    The login system is failing for users with special
    characters in their passwords.
  notes: |
    Check with security team before deploying.
  
  - B @Bob "Subtask" due: 2025-09-30
```

### Prefix Tokens
- `A`, `B`, `C`, `D` - Priority levels (A = highest)
- `x` - Mark task as completed
- `-` - Mark task as skipped
- `@Name` - Assign to stakeholder
- `#tag` - Add tags

### Key-Value Pairs
- Single line: `key: value`
- Multi-line with pipe: `key: |` followed by indented content

## Configuration

The extension provides several configuration options:

- `todoTask.linting.enabled` - Enable/disable linting (default: true)
- `todoTask.linting.indentSize` - Indentation size in spaces (default: 2)
- `todoTask.linting.showWarnings` - Show warnings in addition to errors (default: true)

## Commands

- `Todo Task: Lint Current File` - Manually trigger linting for the current file
- `Todo Task: Show Settings` - Open extension settings

## Installation

1. Copy the extension folder to your VS Code extensions directory
2. Reload VS Code
3. Open any `.task.md` file to activate the extension

## Development

This extension reuses the linting logic from the todo CLI tool via a symlink, ensuring consistency between CLI and IDE validation.

### File Structure
```
ext/
├── package.json              # Extension manifest
├── src/
│   ├── extension.js          # Main extension entry point
│   ├── server.js             # Language server implementation
│   └── linter.js             # Symlink to ../src/linter.js
├── syntaxes/
│   └── todo-task.tmGrammar.json  # TextMate grammar for syntax highlighting
└── language-configuration.json   # Language configuration
```

## License

MIT