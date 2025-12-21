import { describe, expect, test } from 'bun:test';
import { LogLevel, parseLogLevel } from './types';

describe('parseLogLevel', () => {
  describe('known levels parse correctly', () => {
    test('parses debug level', () => {
      expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG);
    });

    test('parses info level', () => {
      expect(parseLogLevel('info')).toBe(LogLevel.INFO);
    });

    test('parses warn level', () => {
      expect(parseLogLevel('warn')).toBe(LogLevel.WARN);
    });

    test('parses error level', () => {
      expect(parseLogLevel('error')).toBe(LogLevel.ERROR);
    });
  });

  describe('case insensitive parsing', () => {
    test('parses uppercase DEBUG', () => {
      expect(parseLogLevel('DEBUG')).toBe(LogLevel.DEBUG);
    });

    test('parses uppercase INFO', () => {
      expect(parseLogLevel('INFO')).toBe(LogLevel.INFO);
    });

    test('parses uppercase WARN', () => {
      expect(parseLogLevel('WARN')).toBe(LogLevel.WARN);
    });

    test('parses uppercase ERROR', () => {
      expect(parseLogLevel('ERROR')).toBe(LogLevel.ERROR);
    });

    test('parses mixed case', () => {
      expect(parseLogLevel('Debug')).toBe(LogLevel.DEBUG);
      expect(parseLogLevel('Info')).toBe(LogLevel.INFO);
      expect(parseLogLevel('Warn')).toBe(LogLevel.WARN);
      expect(parseLogLevel('Error')).toBe(LogLevel.ERROR);
    });
  });

  describe('unknown strings return INFO as default', () => {
    test('returns INFO for unknown string', () => {
      expect(parseLogLevel('verbose')).toBe(LogLevel.INFO);
    });

    test('returns INFO for garbage input', () => {
      expect(parseLogLevel('garbage')).toBe(LogLevel.INFO);
    });

    test('returns INFO for typos', () => {
      expect(parseLogLevel('debg')).toBe(LogLevel.INFO);
      expect(parseLogLevel('warning')).toBe(LogLevel.INFO);
      expect(parseLogLevel('err')).toBe(LogLevel.INFO);
    });
  });

  describe('empty string returns INFO as default', () => {
    test('returns INFO for empty string', () => {
      expect(parseLogLevel('')).toBe(LogLevel.INFO);
    });
  });
});
