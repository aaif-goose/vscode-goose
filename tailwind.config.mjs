/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/webview/**/*.{tsx,ts,html}'],
  theme: {
    extend: {
      colors: {
        editor: 'var(--vscode-editor-background)',
        'editor-fg': 'var(--vscode-editor-foreground)',
        button: 'var(--vscode-button-background)',
        'button-fg': 'var(--vscode-button-foreground)',
        'button-hover': 'var(--vscode-button-hoverBackground)',
        input: 'var(--vscode-input-background)',
        'input-fg': 'var(--vscode-input-foreground)',
        'input-border': 'var(--vscode-input-border)',
        focus: 'var(--vscode-focusBorder)',
        link: 'var(--vscode-textLink-foreground)',
        'link-hover': 'var(--vscode-textLink-activeForeground)',
      },
    },
  },
  plugins: [],
};
