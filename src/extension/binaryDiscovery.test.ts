import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import * as E from 'fp-ts/Either';
import { BinaryDiscoveryConfig } from '../shared/types';

// Track paths that should "exist" for our tests
let mockExistingPaths: Set<string> = new Set();

// Mock fs module before importing binaryDiscovery
mock.module('fs', () => ({
  accessSync: (path: string, _mode?: number) => {
    if (mockExistingPaths.has(path)) {
      return undefined;
    }
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    throw error;
  },
  constants: {
    X_OK: 1,
  },
}));

// Import the module under test AFTER mocking fs
import {
  expandPath,
  checkPathExists,
  findInPath,
  findInPlatformPaths,
  discoverBinary,
  getAllSearchPaths,
} from './binaryDiscovery';

describe('binaryDiscovery', () => {
  beforeEach(() => {
    mockExistingPaths = new Set<string>();
  });

  afterEach(() => {
    mockExistingPaths.clear();
  });

  // Helper to add paths that "exist"
  const addExistingPath = (path: string) => mockExistingPaths.add(path);

  describe('expandPath', () => {
    const homeDir = '/home/testuser';
    const env: NodeJS.ProcessEnv = {
      LOCALAPPDATA: 'C:\\Users\\Test\\AppData\\Local',
      PROGRAMFILES: 'C:\\Program Files',
      CUSTOM_VAR: '/custom/path',
    };

    describe('tilde expansion', () => {
      test('expands ~ at start of path to home directory', () => {
        const result = expandPath('~/.local/bin/goose', homeDir, env);
        expect(result).toBe('/home/testuser/.local/bin/goose');
      });

      test('expands ~ alone to home directory', () => {
        const result = expandPath('~', homeDir, env);
        expect(result).toBe('/home/testuser');
      });

      test('does not expand ~ in middle of path', () => {
        const result = expandPath('/some/path/~user/file', homeDir, env);
        expect(result).toBe('/some/path/~user/file');
      });
    });

    describe('environment variable expansion', () => {
      test('expands %VAR% style variables', () => {
        const result = expandPath('%LOCALAPPDATA%\\Goose\\goose.exe', homeDir, env);
        expect(result).toBe('C:\\Users\\Test\\AppData\\Local\\Goose\\goose.exe');
      });

      test('expands multiple %VAR% in same path', () => {
        const result = expandPath('%LOCALAPPDATA%\\%CUSTOM_VAR%\\file', homeDir, env);
        expect(result).toBe('C:\\Users\\Test\\AppData\\Local\\/custom/path\\file');
      });

      test('replaces undefined variables with empty string', () => {
        const result = expandPath('%UNDEFINED_VAR%\\file', homeDir, env);
        expect(result).toBe('\\file');
      });

      test('expands %PROGRAMFILES%', () => {
        const result = expandPath('%PROGRAMFILES%\\Goose\\goose.exe', homeDir, env);
        expect(result).toBe('C:\\Program Files\\Goose\\goose.exe');
      });
    });

    describe('unchanged paths', () => {
      test('returns absolute path unchanged', () => {
        const result = expandPath('/usr/local/bin/goose', homeDir, env);
        expect(result).toBe('/usr/local/bin/goose');
      });

      test('returns Windows absolute path unchanged', () => {
        const result = expandPath('C:\\Program Files\\goose.exe', homeDir, env);
        expect(result).toBe('C:\\Program Files\\goose.exe');
      });

      test('returns relative path unchanged', () => {
        const result = expandPath('./bin/goose', homeDir, env);
        expect(result).toBe('./bin/goose');
      });
    });
  });

  describe('checkPathExists', () => {
    test('returns true when file exists and is executable', () => {
      addExistingPath('/usr/local/bin/goose');
      const result = checkPathExists('/usr/local/bin/goose');
      expect(result).toBe(true);
    });

    test('returns false when file does not exist', () => {
      const result = checkPathExists('/nonexistent/path');
      expect(result).toBe(false);
    });
  });

  describe('findInPath', () => {
    describe('on unix-like systems', () => {
      const originalPlatform = process.platform;

      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      });

      afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      });

      test('returns first matching path entry', () => {
        const env: NodeJS.ProcessEnv = {
          PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin',
        };
        addExistingPath('/opt/homebrew/bin/goose');
        addExistingPath('/usr/bin/goose');

        const result = findInPath(env);
        expect(result).toBe('/opt/homebrew/bin/goose');
      });

      test('returns undefined when not found in any PATH directory', () => {
        const env: NodeJS.ProcessEnv = {
          PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin',
        };
        // No paths added to mockExistingPaths

        const result = findInPath(env);
        expect(result).toBeUndefined();
      });

      test('handles empty PATH', () => {
        const env: NodeJS.ProcessEnv = { PATH: '' };

        const result = findInPath(env);
        expect(result).toBeUndefined();
      });

      test('handles undefined PATH', () => {
        const env: NodeJS.ProcessEnv = {};

        const result = findInPath(env);
        expect(result).toBeUndefined();
      });

      test('skips empty path entries', () => {
        const env: NodeJS.ProcessEnv = {
          PATH: '/usr/local/bin::/opt/homebrew/bin',
        };
        addExistingPath('/opt/homebrew/bin/goose');

        const result = findInPath(env);
        expect(result).toBe('/opt/homebrew/bin/goose');
      });
    });

    describe('on windows', () => {
      const originalPlatform = process.platform;

      beforeEach(() => {
        Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      });

      afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      });

      test('uses Path instead of PATH when PATH not present', () => {
        const env: NodeJS.ProcessEnv = {
          Path: 'C:\\Windows\\System32;C:\\Program Files\\Goose',
        };
        // Note: path.join uses forward slash on unix, so we account for cross-platform behavior
        // The actual path that would be checked by path.join
        const expectedPath = 'C:\\Program Files\\Goose/goose.exe';
        addExistingPath(expectedPath);

        const result = findInPath(env);
        expect(result).toBe(expectedPath);
      });

      test('looks for goose.exe on windows', () => {
        const env: NodeJS.ProcessEnv = {
          PATH: 'C:\\Program Files\\Goose',
        };
        // Note: path.join uses forward slash on unix, so we account for cross-platform behavior
        const expectedPath = 'C:\\Program Files\\Goose/goose.exe';
        addExistingPath(expectedPath);

        const result = findInPath(env);
        expect(result).toBe(expectedPath);
      });
    });
  });

  describe('findInPlatformPaths', () => {
    const homeDir = '/home/testuser';
    const env: NodeJS.ProcessEnv = {
      LOCALAPPDATA: 'C:\\Users\\Test\\AppData\\Local',
      PROGRAMFILES: 'C:\\Program Files',
    };

    describe('darwin platform', () => {
      test('searches darwin-specific paths', () => {
        addExistingPath('/Applications/Goose.app/Contents/MacOS/goose');

        const result = findInPlatformPaths('darwin', homeDir, env);
        expect(result).toBe('/Applications/Goose.app/Contents/MacOS/goose');
      });

      test('returns first found path in priority order', () => {
        addExistingPath('/home/testuser/.local/bin/goose');
        addExistingPath('/usr/local/bin/goose');

        const result = findInPlatformPaths('darwin', homeDir, env);
        // ~/.local/bin comes after /Applications/Goose.app in darwin paths
        // So if only these two exist, it should return the first in the list
        expect(result).toBe('/home/testuser/.local/bin/goose');
      });

      test('returns undefined when no platform paths exist', () => {
        const result = findInPlatformPaths('darwin', homeDir, env);
        expect(result).toBeUndefined();
      });
    });

    describe('win32 platform', () => {
      test('searches win32-specific paths with expanded variables', () => {
        addExistingPath('C:\\Users\\Test\\AppData\\Local\\Goose\\goose.exe');

        const result = findInPlatformPaths('win32', homeDir, env);
        expect(result).toBe('C:\\Users\\Test\\AppData\\Local\\Goose\\goose.exe');
      });

      test('searches PROGRAMFILES location', () => {
        addExistingPath('C:\\Program Files\\Goose\\goose.exe');

        const result = findInPlatformPaths('win32', homeDir, env);
        expect(result).toBe('C:\\Program Files\\Goose\\goose.exe');
      });
    });

    describe('linux platform', () => {
      test('searches linux-specific paths', () => {
        addExistingPath('/usr/local/bin/goose');

        const result = findInPlatformPaths('linux', homeDir, env);
        expect(result).toBe('/usr/local/bin/goose');
      });

      test('expands tilde in linux paths', () => {
        addExistingPath('/home/testuser/.local/bin/goose');

        const result = findInPlatformPaths('linux', homeDir, env);
        expect(result).toBe('/home/testuser/.local/bin/goose');
      });
    });

    describe('unknown platform', () => {
      test('returns undefined for unknown platform', () => {
        const result = findInPlatformPaths('freebsd' as NodeJS.Platform, homeDir, env);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('discoverBinary', () => {
    const homeDir = '/home/testuser';
    const env: NodeJS.ProcessEnv = {
      PATH: '/usr/local/bin:/usr/bin',
      LOCALAPPDATA: 'C:\\Users\\Test\\AppData\\Local',
    };

    describe('precedence order', () => {
      test('user configured path takes precedence over PATH', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: '/custom/path/goose',
          platform: 'darwin',
          env,
          homeDir,
        };
        addExistingPath('/custom/path/goose');
        addExistingPath('/usr/local/bin/goose');

        const result = discoverBinary(config);
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right).toBe('/custom/path/goose');
        }
      });

      test('user configured path takes precedence over platform paths', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: '/custom/path/goose',
          platform: 'darwin',
          env: { ...env, PATH: '' },
          homeDir,
        };
        addExistingPath('/custom/path/goose');
        addExistingPath('/Applications/Goose.app/Contents/MacOS/goose');

        const result = discoverBinary(config);
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right).toBe('/custom/path/goose');
        }
      });

      test('PATH takes precedence over platform paths when no user config', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: undefined,
          platform: 'darwin',
          env,
          homeDir,
        };
        addExistingPath('/usr/local/bin/goose');
        addExistingPath('/Applications/Goose.app/Contents/MacOS/goose');

        const result = discoverBinary(config);
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right).toBe('/usr/local/bin/goose');
        }
      });

      test('falls back to platform paths when user config and PATH fail', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: '/nonexistent/goose',
          platform: 'darwin',
          env: { ...env, PATH: '' },
          homeDir,
        };
        addExistingPath('/Applications/Goose.app/Contents/MacOS/goose');

        const result = discoverBinary(config);
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right).toBe('/Applications/Goose.app/Contents/MacOS/goose');
        }
      });

      test('falls back to platform paths when no user config and PATH fails', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: undefined,
          platform: 'darwin',
          env: { ...env, PATH: '' },
          homeDir,
        };
        addExistingPath('/opt/homebrew/bin/goose');

        const result = discoverBinary(config);
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right).toBe('/opt/homebrew/bin/goose');
        }
      });
    });

    describe('path expansion', () => {
      test('expands tilde in user configured path', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: '~/.local/bin/goose',
          platform: 'darwin',
          env,
          homeDir,
        };
        addExistingPath('/home/testuser/.local/bin/goose');

        const result = discoverBinary(config);
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right).toBe('/home/testuser/.local/bin/goose');
        }
      });

      test('expands environment variables in user configured path', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: '%LOCALAPPDATA%\\Goose\\goose.exe',
          platform: 'win32',
          env,
          homeDir,
        };
        addExistingPath('C:\\Users\\Test\\AppData\\Local\\Goose\\goose.exe');

        const result = discoverBinary(config);
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right).toBe('C:\\Users\\Test\\AppData\\Local\\Goose\\goose.exe');
        }
      });
    });

    describe('BinaryNotFoundError', () => {
      test('returns BinaryNotFoundError when binary not found anywhere', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: undefined,
          platform: 'darwin',
          env: { ...env, PATH: '' },
          homeDir,
        };
        // No paths added to mockExistingPaths

        const result = discoverBinary(config);
        expect(E.isLeft(result)).toBe(true);
        if (E.isLeft(result)) {
          expect(result.left._tag).toBe('BinaryNotFoundError');
        }
      });

      test('returns BinaryNotFoundError when user config path does not exist', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: '/nonexistent/goose',
          platform: 'darwin',
          env: { ...env, PATH: '' },
          homeDir,
        };
        // No paths exist

        const result = discoverBinary(config);
        expect(E.isLeft(result)).toBe(true);
        if (E.isLeft(result)) {
          expect(result.left._tag).toBe('BinaryNotFoundError');
        }
      });

      test('BinaryNotFoundError includes searched paths', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: '/custom/goose',
          platform: 'darwin',
          env: { ...env, PATH: '' },
          homeDir,
        };
        // No paths exist

        const result = discoverBinary(config);
        expect(E.isLeft(result)).toBe(true);
        if (E.isLeft(result)) {
          expect(result.left._tag).toBe('BinaryNotFoundError');
          expect(result.left.searchedPaths.length).toBeGreaterThan(0);
          expect(result.left.searchedPaths).toContain('/custom/goose');
        }
      });

      test('BinaryNotFoundError includes platform', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: undefined,
          platform: 'linux',
          env: { ...env, PATH: '' },
          homeDir,
        };

        const result = discoverBinary(config);
        expect(E.isLeft(result)).toBe(true);
        if (E.isLeft(result)) {
          expect(result.left._tag).toBe('BinaryNotFoundError');
          expect(result.left.platform).toBe('linux');
        }
      });
    });

    describe('edge cases', () => {
      test('handles undefined user config path', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: undefined,
          platform: 'darwin',
          env,
          homeDir,
        };
        addExistingPath('/usr/local/bin/goose');

        const result = discoverBinary(config);
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right).toBe('/usr/local/bin/goose');
        }
      });

      test('handles empty environment', () => {
        const config: BinaryDiscoveryConfig = {
          userConfiguredPath: undefined,
          platform: 'darwin',
          env: {},
          homeDir,
        };
        addExistingPath('/Applications/Goose.app/Contents/MacOS/goose');

        const result = discoverBinary(config);
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right).toBe('/Applications/Goose.app/Contents/MacOS/goose');
        }
      });
    });
  });

  describe('getAllSearchPaths', () => {
    test('includes user configured path when present', () => {
      const config: BinaryDiscoveryConfig = {
        userConfiguredPath: '/custom/goose',
        platform: 'darwin',
        env: {},
        homeDir: '/home/testuser',
      };

      const paths = getAllSearchPaths(config);
      expect(paths).toContain('/custom/goose');
    });

    test('includes PATH environment variable placeholder', () => {
      const config: BinaryDiscoveryConfig = {
        userConfiguredPath: undefined,
        platform: 'darwin',
        env: {},
        homeDir: '/home/testuser',
      };

      const paths = getAllSearchPaths(config);
      expect(paths).toContain('PATH environment variable');
    });

    test('includes platform-specific paths', () => {
      const config: BinaryDiscoveryConfig = {
        userConfiguredPath: undefined,
        platform: 'darwin',
        env: {},
        homeDir: '/home/testuser',
      };

      const paths = getAllSearchPaths(config);
      expect(paths).toContain('/Applications/Goose.app/Contents/MacOS/goose');
      expect(paths).toContain('/home/testuser/.local/bin/goose');
    });

    test('expands tilde in returned paths', () => {
      const config: BinaryDiscoveryConfig = {
        userConfiguredPath: '~/.local/bin/goose',
        platform: 'darwin',
        env: {},
        homeDir: '/home/testuser',
      };

      const paths = getAllSearchPaths(config);
      expect(paths[0]).toBe('/home/testuser/.local/bin/goose');
    });
  });
});
