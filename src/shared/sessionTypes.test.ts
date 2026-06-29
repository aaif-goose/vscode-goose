import { describe, expect, test } from 'bun:test';
import { truncatePath } from './sessionTypes';

describe('truncatePath', () => {
  test('returns paths within the max length unchanged', () => {
    const path = 'C:\\Users\\prem\\file.ts';

    expect(truncatePath(path, 100)).toBe(path);
  });

  test('truncates Unix paths with forward slash separators', () => {
    expect(
      truncatePath('/Users/prem/Development/vscode-goose/src/shared/sessionTypes.ts', 30)
    ).toBe('.../shared/sessionTypes.ts');
  });

  test('truncates Windows paths with backslash separators', () => {
    expect(
      truncatePath('C:\\Users\\prem\\Development\\vscode-goose\\src\\shared\\sessionTypes.ts', 30)
    ).toBe('...\\shared\\sessionTypes.ts');
  });
});
