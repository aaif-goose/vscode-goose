import { describe, expect, test } from 'bun:test';
import {
  parseVersion,
  compareVersions,
  meetsMinimumVersion,
  MINIMUM_VERSION,
} from './versionChecker';

describe('parseVersion', () => {
  test('parses simple version', () => {
    expect(parseVersion('1.16.0')).toBe('1.16.0');
  });

  test('parses version with v prefix', () => {
    expect(parseVersion('v1.16.0')).toBe('1.16.0');
  });

  test('parses version with goose prefix', () => {
    expect(parseVersion('goose 1.16.0')).toBe('1.16.0');
  });

  test('parses version with "goose version" prefix', () => {
    expect(parseVersion('goose version 1.16.0')).toBe('1.16.0');
  });

  test('parses version with pre-release suffix', () => {
    expect(parseVersion('Goose 1.16.0-beta')).toBe('1.16.0');
  });

  test('parses two-segment version', () => {
    expect(parseVersion('1.16')).toBe('1.16');
  });

  test('handles whitespace', () => {
    expect(parseVersion('  1.16.0  \n')).toBe('1.16.0');
  });

  test('returns null for empty string', () => {
    expect(parseVersion('')).toBe(null);
  });

  test('returns null for whitespace only', () => {
    expect(parseVersion('   ')).toBe(null);
  });

  test('returns null for invalid version', () => {
    expect(parseVersion('not a version')).toBe(null);
  });
});

describe('compareVersions', () => {
  test('equal versions return 0', () => {
    expect(compareVersions('1.16.0', '1.16.0')).toBe(0);
  });

  test('major version difference', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  test('minor version difference', () => {
    expect(compareVersions('1.17.0', '1.16.0')).toBeGreaterThan(0);
    expect(compareVersions('1.16.0', '1.17.0')).toBeLessThan(0);
  });

  test('patch version difference', () => {
    expect(compareVersions('1.16.1', '1.16.0')).toBeGreaterThan(0);
    expect(compareVersions('1.16.0', '1.16.1')).toBeLessThan(0);
  });

  test('handles two-segment versions', () => {
    expect(compareVersions('1.16', '1.16.0')).toBe(0);
    expect(compareVersions('1.16', '1.15.9')).toBeGreaterThan(0);
  });
});

describe('meetsMinimumVersion', () => {
  test('exact minimum version is compatible', () => {
    expect(meetsMinimumVersion('1.16.0', '1.16.0')).toBe(true);
  });

  test('higher patch version is compatible', () => {
    expect(meetsMinimumVersion('1.16.1', '1.16.0')).toBe(true);
  });

  test('higher minor version is compatible', () => {
    expect(meetsMinimumVersion('1.17.0', '1.16.0')).toBe(true);
  });

  test('higher major version is compatible', () => {
    expect(meetsMinimumVersion('2.0.0', '1.16.0')).toBe(true);
  });

  test('lower version is incompatible', () => {
    expect(meetsMinimumVersion('1.15.9', '1.16.0')).toBe(false);
    expect(meetsMinimumVersion('1.0.0', '1.16.0')).toBe(false);
    expect(meetsMinimumVersion('0.99.0', '1.16.0')).toBe(false);
  });
});

describe('MINIMUM_VERSION', () => {
  test('is set to 1.16.0', () => {
    expect(MINIMUM_VERSION).toBe('1.16.0');
  });
});
