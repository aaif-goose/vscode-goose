import { describe, expect, test } from 'bun:test';
import {
  getLanguageFromPath,
  isFileReferenceContent,
  parseContent,
  parseFileReference,
} from './fileReferenceParser';

describe('isFileReferenceContent', () => {
  test('detects Unix absolute path (H1 style)', () => {
    expect(isFileReferenceContent('# /Users/prem/file.ts')).toBe(true);
  });

  test('detects Windows absolute path (H1 style)', () => {
    expect(isFileReferenceContent('# C:\\Users\\prem\\file.ts')).toBe(true);
  });

  test('detects File: prefix style', () => {
    expect(isFileReferenceContent('File: /Users/prem/file.ts')).toBe(true);
  });

  test('detects File: prefix with line range', () => {
    expect(isFileReferenceContent('File: /Users/prem/file.ts:10-20')).toBe(true);
  });

  test('detects with leading whitespace', () => {
    expect(isFileReferenceContent('  # /path/to/file.ts')).toBe(true);
  });

  test('detects with leading newlines', () => {
    expect(isFileReferenceContent('\n\n# /path/to/file.ts')).toBe(true);
  });

  test('rejects regular H1 headers', () => {
    expect(isFileReferenceContent('# Hello World')).toBe(false);
  });

  test('rejects relative paths', () => {
    expect(isFileReferenceContent('# ./relative/path.ts')).toBe(false);
    expect(isFileReferenceContent('# relative/path.ts')).toBe(false);
  });

  test('rejects non-H1 content', () => {
    expect(isFileReferenceContent('/path/to/file.ts')).toBe(false);
    expect(isFileReferenceContent('## /path/to/file.ts')).toBe(false);
  });

  test('rejects empty content', () => {
    expect(isFileReferenceContent('')).toBe(false);
    expect(isFileReferenceContent('   ')).toBe(false);
  });
});

describe('parseFileReference', () => {
  test('parses simple Unix path', () => {
    const result = parseFileReference('# /Users/prem/Development/test.json');

    expect(result).not.toBeNull();
    expect(result?.filePath).toBe('/Users/prem/Development/test.json');
    expect(result?.fileName).toBe('test.json');
    expect(result?.content).toBeUndefined();
    expect(result?.language).toBeUndefined();
  });

  test('parses Windows path', () => {
    const result = parseFileReference('# C:\\Users\\prem\\test.json');

    expect(result).not.toBeNull();
    expect(result?.filePath).toBe('C:\\Users\\prem\\test.json');
    expect(result?.fileName).toBe('test.json');
  });

  test('parses path with code block', () => {
    const content = `# /path/to/file.json
\`\`\`json
[]
\`\`\``;

    const result = parseFileReference(content);

    expect(result).not.toBeNull();
    expect(result?.filePath).toBe('/path/to/file.json');
    expect(result?.fileName).toBe('file.json');
    expect(result?.content).toBe('[]');
    expect(result?.language).toBe('json');
  });

  test('parses path with multiline code block', () => {
    const content = `# /path/to/config.yaml
\`\`\`yaml
name: test
version: 1.0.0
dependencies:
  - foo
  - bar
\`\`\``;

    const result = parseFileReference(content);

    expect(result).not.toBeNull();
    expect(result?.filePath).toBe('/path/to/config.yaml');
    expect(result?.language).toBe('yaml');
    expect(result?.content).toContain('name: test');
    expect(result?.content).toContain('dependencies:');
  });

  test('parses path with code block without language', () => {
    const content = `# /path/to/file.txt
\`\`\`
some content
\`\`\``;

    const result = parseFileReference(content);

    expect(result).not.toBeNull();
    expect(result?.content).toBe('some content');
    expect(result?.language).toBeUndefined();
  });

  test('handles leading/trailing whitespace', () => {
    const content = `
# /path/to/file.ts
  `;

    const result = parseFileReference(content);

    expect(result).not.toBeNull();
    expect(result?.filePath).toBe('/path/to/file.ts');
  });

  test('returns null for regular markdown', () => {
    expect(parseFileReference('# Hello World')).toBeNull();
    expect(parseFileReference('Some regular text')).toBeNull();
    expect(parseFileReference('## Heading 2')).toBeNull();
  });

  test('returns null for empty content', () => {
    expect(parseFileReference('')).toBeNull();
    expect(parseFileReference('   ')).toBeNull();
  });

  test('handles deeply nested paths', () => {
    const path = '/Users/prem/Development/vscode-mcp/manual-tests/dirs-stuff/more/depth/test.json';
    const result = parseFileReference(`# ${path}`);

    expect(result).not.toBeNull();
    expect(result?.filePath).toBe(path);
    expect(result?.fileName).toBe('test.json');
  });

  test('handles paths with spaces', () => {
    const result = parseFileReference('# /Users/prem/My Documents/file.txt');

    expect(result).not.toBeNull();
    expect(result?.filePath).toBe('/Users/prem/My Documents/file.txt');
    expect(result?.fileName).toBe('file.txt');
  });

  test('handles paths with special characters', () => {
    const result = parseFileReference('# /path/to/file-name_v2.test.ts');

    expect(result).not.toBeNull();
    expect(result?.fileName).toBe('file-name_v2.test.ts');
  });

  test('parses exact Goose format with leading newlines', () => {
    // This is the exact format Goose sends - with leading newlines
    const content = `

# /Users/prem/Development/vscode-mcp/manual-tests/dirs-stuff/more/depth/test.json
\`\`\`
[]

\`\`\``;

    const result = parseFileReference(content);

    expect(result).not.toBeNull();
    expect(result?.filePath).toBe(
      '/Users/prem/Development/vscode-mcp/manual-tests/dirs-stuff/more/depth/test.json'
    );
    expect(result?.fileName).toBe('test.json');
    expect(result?.content).toBe('[]');
    expect(result?.language).toBeUndefined();
  });

  // File: prefix format tests
  test('parses File: prefix format without line range', () => {
    const result = parseFileReference('File: /Users/prem/file.ts');

    expect(result).not.toBeNull();
    expect(result?.filePath).toBe('/Users/prem/file.ts');
    expect(result?.fileName).toBe('file.ts');
    expect(result?.lineRange).toBeUndefined();
  });

  test('parses File: prefix format with line range', () => {
    const content = `File: /Users/prem/Development/vscode-mcp/manual-tests/README.md:63-70
\`\`\`
# Apply a diff
curl -X POST http://localhost:34343/edit-file
\`\`\``;

    const result = parseFileReference(content);

    expect(result).not.toBeNull();
    expect(result?.filePath).toBe('/Users/prem/Development/vscode-mcp/manual-tests/README.md');
    expect(result?.fileName).toBe('README.md');
    expect(result?.lineRange).toEqual({ startLine: 63, endLine: 70 });
    expect(result?.content).toContain('Apply a diff');
  });

  test('parses File: prefix with language in code block', () => {
    const content = `File: /path/to/script.sh:1-10
\`\`\`bash
echo "hello"
\`\`\``;

    const result = parseFileReference(content);

    expect(result).not.toBeNull();
    expect(result?.language).toBe('bash');
    expect(result?.content).toBe('echo "hello"');
    expect(result?.lineRange).toEqual({ startLine: 1, endLine: 10 });
  });
});

describe('parseContent', () => {
  test('returns file_reference type for file content', () => {
    const result = parseContent('# /path/to/file.ts');

    expect(result.type).toBe('file_reference');
    if (result.type === 'file_reference') {
      expect(result.reference.filePath).toBe('/path/to/file.ts');
    }
  });

  test('returns text type for regular content', () => {
    const result = parseContent('Hello world');

    expect(result.type).toBe('text');
    if (result.type === 'text') {
      expect(result.content).toBe('Hello world');
    }
  });

  test('returns text type for regular H1', () => {
    const result = parseContent('# Welcome');

    expect(result.type).toBe('text');
    if (result.type === 'text') {
      expect(result.content).toBe('# Welcome');
    }
  });
});

describe('getLanguageFromPath', () => {
  test('maps TypeScript extensions', () => {
    expect(getLanguageFromPath('/path/file.ts')).toBe('typescript');
    expect(getLanguageFromPath('/path/file.tsx')).toBe('typescriptreact');
  });

  test('maps JavaScript extensions', () => {
    expect(getLanguageFromPath('/path/file.js')).toBe('javascript');
    expect(getLanguageFromPath('/path/file.jsx')).toBe('javascriptreact');
  });

  test('maps Python extension', () => {
    expect(getLanguageFromPath('/path/file.py')).toBe('python');
  });

  test('maps JSON extension', () => {
    expect(getLanguageFromPath('/path/file.json')).toBe('json');
  });

  test('maps shell extensions', () => {
    expect(getLanguageFromPath('/path/file.sh')).toBe('shell');
    expect(getLanguageFromPath('/path/file.bash')).toBe('bash');
  });

  test('maps YAML extensions', () => {
    expect(getLanguageFromPath('/path/file.yaml')).toBe('yaml');
    expect(getLanguageFromPath('/path/file.yml')).toBe('yaml');
  });

  test('returns plaintext for unknown extension', () => {
    expect(getLanguageFromPath('/path/file.xyz')).toBe('plaintext');
    expect(getLanguageFromPath('/path/file')).toBe('plaintext');
  });

  test('handles uppercase extensions', () => {
    expect(getLanguageFromPath('/path/FILE.JSON')).toBe('json');
    expect(getLanguageFromPath('/path/file.TS')).toBe('typescript');
  });
});
