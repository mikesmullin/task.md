# Development Guide

## VS Code Extension Development

This guide explains how to develop and test the Todo Task Language Support extension.

### Prerequisites

- Node.js and npm installed
- VS Code installed
- Basic understanding of VS Code extensions and Language Server Protocol

### Project Structure

```
ext/
├── package.json                      # Extension manifest
├── language-configuration.json       # Language configuration for VS Code
├── README.md                        # Extension documentation
├── example.task.md                  # Example file for testing
├── install.sh                       # Installation script
├── package.sh                       # Packaging script
├── src/
│   ├── extension.js                 # Main extension client
│   ├── server.js                    # Language server implementation
│   └── linter.js                    # Symlink to ../src/linter.js
├── syntaxes/
│   └── todo-task.tmGrammar.json     # TextMate grammar for syntax highlighting
└── node_modules/                    # Dependencies
```

### Development Setup

1. **Install dependencies:**
   ```bash
   cd ext/
   npm install
   ```

2. **Open in VS Code:**
   ```bash
   code .
   ```

3. **Launch Extension Development Host:**
   - Press `F5` or go to `Run > Start Debugging`
   - This opens a new VS Code window with your extension loaded

4. **Test the extension:**
   - In the Extension Development Host window, open `example.task.md`
   - You should see syntax highlighting and real-time linting

### Key Components

#### 1. Extension Client (`src/extension.js`)
- Activates when `.task.md` files are opened
- Starts the language server
- Registers commands for manual linting and settings

#### 2. Language Server (`src/server.js`)
- Provides real-time diagnostics using the shared linter logic
- Offers completion suggestions for task properties and prefix tokens
- Provides hover information for task elements
- Implements Language Server Protocol (LSP)

#### 3. Shared Linter Logic (`src/linter.js`)
- Symlinked to `../src/linter.js` from the main todo CLI project
- Ensures consistent validation between CLI and IDE
- Validates task syntax, indentation, key-value pairs, etc.

#### 4. Syntax Highlighting (`syntaxes/todo-task.tmGrammar.json`)
- TextMate grammar for syntax highlighting
- Highlights priorities, stakeholders, tags, quoted strings, keys, etc.

### Testing

1. **Manual Testing:**
   - Open `example.task.md` in the Extension Development Host
   - Try creating syntax errors to see if they're detected
   - Test completion (type `@`, `#`, or start typing key names)
   - Test hover (hover over priority tokens like `A`, `B`, etc.)

2. **Test Different Scenarios:**
   - Valid task syntax
   - Invalid indentation
   - Misplaced prefix tokens
   - Unmatched quotes
   - Missing pipe characters for multi-line content

### Configuration

The extension supports these settings:
- `todoTask.linting.enabled` - Enable/disable linting
- `todoTask.linting.indentSize` - Indentation size (default: 2)
- `todoTask.linting.showWarnings` - Show warnings (default: true)

### Debugging

1. **Extension Host Debugging:**
   - Use `console.log()` in `extension.js`
   - View output in the Extension Development Host's Debug Console

2. **Language Server Debugging:**
   - Use `connection.console.log()` in `server.js`
   - View output in VS Code's Output panel (select "Todo Task Language Server")

3. **Linter Debugging:**
   - Test the linter independently using the CLI: `todo lint example.task.md`
   - Add console.log statements to the shared linter.js file

### Building and Distribution

1. **Package for distribution:**
   ```bash
   ./package.sh
   ```

2. **Install locally:**
   ```bash
   ./install.sh
   ```

### Extension Architecture

The extension uses the Language Server Protocol (LSP) architecture:

```
VS Code Client           Language Server
┌─────────────────┐     ┌─────────────────┐
│  extension.js   │────▶│   server.js     │
│  - Activation   │     │  - Diagnostics  │
│  - Commands     │     │  - Completion   │
│  - LSP Client   │     │  - Hover        │
└─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   linter.js     │
                        │  (shared logic) │
                        └─────────────────┘
```

This architecture provides:
- Real-time validation as you type
- Consistent linting between CLI and IDE
- Rich language features (completion, hover, etc.)
- Extensible foundation for future features

### Future Enhancements

Potential improvements:
- Code actions for quick fixes
- Document formatting
- Symbol navigation
- Task completion status tracking
- Integration with todo CLI commands
- Workspace-wide task search and management