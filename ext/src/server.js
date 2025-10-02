import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult
} from 'vscode-languageserver/node.js';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { lintLines } from './linter.js';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

// Default settings
const defaultSettings = {
  linting: {
    enabled: true,
    indentSize: 2,
    showWarnings: true
  }
};

let globalSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings = new Map();

connection.onInitialize((params) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  const result = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [':', '@', '#']
      },
      hoverProvider: true
    }
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

connection.onDidChangeConfiguration(change => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = (change.settings.todoTask || defaultSettings);
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource) {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'todoTask'
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
  documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument) {
  // Get the settings for this document
  const settings = await getDocumentSettings(textDocument.uri);

  if (!settings.linting?.enabled) {
    // Clear diagnostics if linting is disabled
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
    return;
  }

  const text = textDocument.getText();
  const lines = text.split(/\r?\n/);

  // Use the existing linter logic
  const lintOptions = {
    indentSize: settings.linting?.indentSize || 2
  };

  const { errors, warnings } = lintLines(lines, lintOptions);

  const diagnostics = [];

  // Convert errors to diagnostics
  for (const error of errors) {
    const lineIndex = error.line - 1; // Convert to 0-based index
    const line = lines[lineIndex] || '';

    const diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: lineIndex, character: 0 },
        end: { line: lineIndex, character: line.length }
      },
      message: error.msg,
      source: 'todo-task-linter'
    };
    diagnostics.push(diagnostic);
  }

  // Convert warnings to diagnostics if enabled
  if (settings.linting?.showWarnings) {
    for (const warning of warnings) {
      const lineIndex = warning.line - 1; // Convert to 0-based index
      const line = lines[lineIndex] || '';

      const diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: line.length }
        },
        message: warning.msg,
        source: 'todo-task-linter'
      };
      diagnostics.push(diagnostic);
    }
  }

  // Send the computed diagnostics to VS Code
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
  // Monitored files have change in VS Code
  connection.console.log('We received a file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion((textDocumentPosition) => {
  const document = documents.get(textDocumentPosition.textDocument.uri);
  if (!document) {
    return [];
  }

  const position = textDocumentPosition.position;
  const lineText = document.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line, character: position.character }
  });

  // Provide completion for common keys
  const commonKeys = [
    'title', 'description', 'notes', 'due', 'priority', 'weight', 'effort',
    'category', 'status', 'assignee', 'stakeholder', 'tags', 'id'
  ];

  // Provide completion for prefix tokens at the start of task lines
  const prefixTokens = [
    { label: 'A', detail: 'Priority A (highest)' },
    { label: 'B', detail: 'Priority B' },
    { label: 'C', detail: 'Priority C' },
    { label: 'D', detail: 'Priority D (lowest)' },
    { label: 'x', detail: 'Mark as completed' },
    { label: '-', detail: 'Mark as skipped' }
  ];

  const completions = [];

  // Check if we're at the start of a task line (after bullet point)
  const bulletMatch = lineText.match(/^\s*-\s*/);
  if (bulletMatch && position.character <= bulletMatch[0].length + 10) {
    // Add prefix token completions
    completions.push(...prefixTokens.map(token => ({
      label: token.label,
      kind: CompletionItemKind.Keyword,
      detail: token.detail,
      insertText: token.label + ' '
    })));

    // Add stakeholder completion trigger
    completions.push({
      label: '@',
      kind: CompletionItemKind.Keyword,
      detail: 'Stakeholder assignment',
      insertText: '@'
    });

    // Add tag completion trigger
    completions.push({
      label: '#',
      kind: CompletionItemKind.Keyword,
      detail: 'Tag',
      insertText: '#'
    });
  }

  // Check if we're in a position for key completion
  const indentMatch = lineText.match(/^(\s+)$/);
  if (indentMatch || lineText.match(/^\s+[A-Za-z_]*$/)) {
    // Add key completions
    completions.push(...commonKeys.map(key => ({
      label: key,
      kind: CompletionItemKind.Property,
      detail: `Task property: ${key}`,
      insertText: key + ': '
    })));
  }

  return completions;
});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
  if (item.label === 'title') {
    item.detail = 'Task title';
    item.documentation = 'The main title/description of the task';
  } else if (item.label === 'due') {
    item.detail = 'Due date';
    item.documentation = 'When the task is due (YYYY-MM-DD format recommended)';
  } else if (item.label === 'priority') {
    item.detail = 'Task priority';
    item.documentation = 'Priority level (A=highest, B, C, D=lowest)';
  }

  return item;
});

// Provide hover information
connection.onHover((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const position = params.position;
  const lineText = document.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line, character: Number.MAX_SAFE_INTEGER }
  });

  // Check if hovering over a prefix token
  const wordRange = getWordRangeAtPosition(lineText, position.character);
  if (wordRange) {
    const word = lineText.substring(wordRange.start, wordRange.end);

    const hoverInfo = {
      'A': 'Priority A (highest priority)',
      'B': 'Priority B',
      'C': 'Priority C',
      'D': 'Priority D (lowest priority)',
      'x': 'Task completed',
      '-': 'Task skipped'
    };

    if (hoverInfo[word]) {
      return {
        contents: {
          kind: 'markdown',
          value: `**${word}**: ${hoverInfo[word]}`
        }
      };
    }

    // Check for stakeholder tokens
    if (word.startsWith('@')) {
      return {
        contents: {
          kind: 'markdown',
          value: `**Stakeholder**: ${word.substring(1)}`
        }
      };
    }

    // Check for tag tokens
    if (word.startsWith('#')) {
      return {
        contents: {
          kind: 'markdown',
          value: `**Tag**: ${word.substring(1)}`
        }
      };
    }
  }

  return null;
});

function getWordRangeAtPosition(text, position) {
  const beforeText = text.substring(0, position);
  const afterText = text.substring(position);

  const beforeMatch = beforeText.match(/[\w@#-]*$/);
  const afterMatch = afterText.match(/^[\w@#-]*/);

  if (beforeMatch && afterMatch) {
    return {
      start: position - beforeMatch[0].length,
      end: position + afterMatch[0].length
    };
  }

  return null;
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();