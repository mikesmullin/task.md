const {
  createConnection,
  TextDocuments,
  DiagnosticSeverity,
  ProposedFeatures,
  TextDocumentSyncKind
} = require('vscode-languageserver/node');

const { TextDocument } = require('vscode-languageserver-textdocument');

// Import linter - with error handling
let lintLines;
try {
  const linterModule = require('./linter.js');
  lintLines = linterModule.lintLines;
  console.log('Linter imported successfully');
} catch (error) {
  console.error('Failed to import linter:', error);
  process.exit(1);
}

// Add global error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Add startup logging
console.log('Server starting...');

let connection;
let documents;

try {
  // Create a connection for the server
  connection = createConnection(ProposedFeatures.all);
  console.log('Connection created successfully');

  // Create a simple text document manager
  documents = new TextDocuments(TextDocument);
  console.log('Document manager created successfully');
} catch (error) {
  console.error('Error during setup:', error);
  process.exit(1);
}

connection.onInitialize((params) => {
  try {
    console.log('Server initializing...');

    const result = {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
      }
    };

    console.log('Server initialization complete');
    return result;
  } catch (error) {
    console.error('Error during initialization:', error);
    throw error;
  }
});

connection.onInitialized(() => {
  try {
    console.log('Server initialized and ready!');
    connection.console.log('Todo Task Language Server is ready and listening!');
  } catch (error) {
    console.error('Error during onInitialized:', error);
  }
});

// Very basic validation - just log and clear diagnostics
documents.onDidChangeContent(change => {
  try {
    console.log(`Document changed: ${change.document.uri}`);
    connection.console.log(`Document changed: ${change.document.uri}`);
    validateTextDocument(change.document);
  } catch (error) {
    console.error('Error in onDidChangeContent:', error);
  }
});

documents.onDidOpen(e => {
  try {
    console.log(`Document opened: ${e.document.uri}`);
    connection.console.log(`Document opened: ${e.document.uri}`);
    validateTextDocument(e.document);
  } catch (error) {
    console.error('Error in onDidOpen:', error);
  }
});

// Validation function
function validateTextDocument(textDocument) {
  try {
    connection.console.log(`Validating: ${textDocument.uri}`);
    
    const text = textDocument.getText();
    const lines = text.split(/\r?\n/);
    
    // Use the existing linter logic
    const lintOptions = {
      indentSize: 2  // Default indentation
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
    
    // Convert warnings to diagnostics
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

    // Send the computed diagnostics to VS Code
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    connection.console.log(`Sent ${diagnostics.length} diagnostics (${errors.length} errors, ${warnings.length} warnings) for ${textDocument.uri}`);
    
  } catch (error) {
    connection.console.error(`Validation error: ${error.message}`);
    console.error('Validation error:', error);
    // Clear diagnostics on error
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
  }
}

try {
  // Make the text document manager listen on the connection
  documents.listen(connection);
  console.log('Document manager listening');

  // Listen on the connection
  console.log('Starting to listen for connections...');
  connection.listen();
  console.log('Server is now listening');
} catch (error) {
  console.error('Error during server startup:', error);
  process.exit(1);
}