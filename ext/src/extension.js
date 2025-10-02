const vscode = require('vscode');
const {
  LanguageClient,
  TransportKind
} = require('vscode-languageclient/node');
const path = require('path');

let client;

function activate(context) {
  console.log('Todo Task Language Support extension is now active!');

  // Server options - use the language server in the same extension
  const serverModule = path.join(__dirname, 'server.js');
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  // Client options
  const clientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'todo-task' },
      { scheme: 'file', pattern: '**/*.task.md' }
    ],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.task.md')
    }
  };

  // Create the language client and start it
  client = new LanguageClient(
    'todoTaskLanguageServer',
    'Todo Task Language Server',
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  const startPromise = client.start();

  // Add error handling for startup
  startPromise.then(() => {
    console.log('Language server started successfully!');
  }).catch((error) => {
    console.error('Error starting language client:', error);
    vscode.window.showErrorMessage(`Error starting language client: ${error.message}`);
  });  // Register additional commands for the extension
  const disposables = [
    vscode.commands.registerCommand('todoTask.lintFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'todo-task') {
        // Trigger validation by sending a didChange event
        client.sendNotification('textDocument/didChange', {
          textDocument: {
            uri: editor.document.uri.toString(),
            version: editor.document.version
          },
          contentChanges: [{
            text: editor.document.getText()
          }]
        });
        vscode.window.showInformationMessage('Todo task file linted!');
      } else {
        vscode.window.showWarningMessage('Please open a .task.md file to lint.');
      }
    }),

    vscode.commands.registerCommand('todoTask.showSettings', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'todoTask');
    })
  ];

  context.subscriptions.push(...disposables);

  // Add the client to subscriptions so it gets disposed properly
  context.subscriptions.push(client);
}

function deactivate() {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

module.exports = {
  activate,
  deactivate
};