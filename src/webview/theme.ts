/**
 * VS Code theme integration constants and utilities.
 * Maps VS Code CSS variables to semantic color names.
 */

export const VS_CODE_COLORS = {
  editorBackground: 'var(--vscode-editor-background)',
  editorForeground: 'var(--vscode-editor-foreground)',
  foreground: 'var(--vscode-foreground)',
  buttonBackground: 'var(--vscode-button-background)',
  buttonForeground: 'var(--vscode-button-foreground)',
  buttonHoverBackground: 'var(--vscode-button-hoverBackground)',
  inputBackground: 'var(--vscode-input-background)',
  inputForeground: 'var(--vscode-input-foreground)',
  inputBorder: 'var(--vscode-input-border)',
  focusBorder: 'var(--vscode-focusBorder)',
  textLinkForeground: 'var(--vscode-textLink-foreground)',
  textLinkActiveForeground: 'var(--vscode-textLink-activeForeground)',
  descriptionForeground: 'var(--vscode-descriptionForeground)',
  errorForeground: 'var(--vscode-errorForeground)',
  warningForeground: 'var(--vscode-editorWarning-foreground)',
  fontFamily: 'var(--vscode-font-family)',
  fontSize: 'var(--vscode-font-size)',
} as const;

export const TAILWIND_COLOR_MAP = {
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
} as const;

export type VsCodeColor = keyof typeof VS_CODE_COLORS;
export type TailwindColor = keyof typeof TAILWIND_COLOR_MAP;
