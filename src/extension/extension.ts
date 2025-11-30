import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Goose');
  outputChannel.appendLine('Goose extension activating...');

  // Register webview provider (placeholder for Milestone 4)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('goose.chatView', {
      resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = {
          enableScripts: true,
          localResourceRoots: [context.extensionUri],
        };
        webviewView.webview.html = getWebviewContent();
      },
    })
  );

  outputChannel.appendLine('Goose extension activated.');
}

export function deactivate(): void {
  // Cleanup will be added in Milestone 3
}

function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Goose</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
    }
    h1 {
      color: var(--vscode-textLink-foreground);
      margin-bottom: 16px;
    }
    p {
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <h1>Hello Goose</h1>
  <p>Foundation scaffold - Webview working!</p>
</body>
</html>`;
}
