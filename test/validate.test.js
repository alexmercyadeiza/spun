import { describe, it, expect } from 'vitest';
import { sanitizeAppName, validatePort } from '../lib/validate.js';

describe('sanitizeAppName', () => {
  it('lowercases input', () => {
    expect(sanitizeAppName('MyApp')).toBe('myapp');
  });

  it('replaces non-alphanumeric chars with hyphens', () => {
    expect(sanitizeAppName('my_cool app')).toBe('my-cool-app');
  });

  it('collapses consecutive hyphens', () => {
    expect(sanitizeAppName('my---app')).toBe('my-app');
  });

  it('trims leading and trailing hyphens', () => {
    expect(sanitizeAppName('-my-app-')).toBe('my-app');
  });

  it('handles dots and special characters', () => {
    expect(sanitizeAppName('my.app@v2!')).toBe('my-app-v2');
  });

  it('handles scoped npm packages', () => {
    expect(sanitizeAppName('@org/my-package')).toBe('org-my-package');
  });

  it('truncates to 63 characters', () => {
    const long = 'a'.repeat(100);
    expect(sanitizeAppName(long).length).toBeLessThanOrEqual(63);
  });

  it('trims trailing hyphen after truncation', () => {
    const name = 'a'.repeat(62) + '-b';
    const result = sanitizeAppName(name);
    expect(result.endsWith('-')).toBe(false);
    expect(result.length).toBeLessThanOrEqual(63);
  });

  it('throws on empty string', () => {
    expect(() => sanitizeAppName('')).toThrow('App name is required');
  });

  it('throws on null', () => {
    expect(() => sanitizeAppName(null)).toThrow('App name is required');
  });

  it('throws on undefined', () => {
    expect(() => sanitizeAppName(undefined)).toThrow('App name is required');
  });

  it('throws on non-string', () => {
    expect(() => sanitizeAppName(42)).toThrow('App name is required');
  });

  it('throws when all chars are invalid', () => {
    expect(() => sanitizeAppName('---')).toThrow('Could not derive');
  });

  it('passes valid names through unchanged', () => {
    expect(sanitizeAppName('my-app')).toBe('my-app');
    expect(sanitizeAppName('app123')).toBe('app123');
    expect(sanitizeAppName('a')).toBe('a');
  });

  it('handles single character names', () => {
    expect(sanitizeAppName('x')).toBe('x');
    expect(sanitizeAppName('5')).toBe('5');
  });
});

describe('validatePort', () => {
  it('accepts valid port numbers', () => {
    expect(validatePort(3001)).toBe(3001);
    expect(validatePort(8080)).toBe(8080);
    expect(validatePort(65535)).toBe(65535);
  });

  it('accepts string port numbers', () => {
    expect(validatePort('3001')).toBe(3001);
    expect(validatePort('9000')).toBe(9000);
  });

  it('rejects ports below 3001', () => {
    expect(() => validatePort(3000)).toThrow('Invalid port');
    expect(() => validatePort(80)).toThrow('Invalid port');
    expect(() => validatePort(0)).toThrow('Invalid port');
  });

  it('rejects ports above 65535', () => {
    expect(() => validatePort(65536)).toThrow('Invalid port');
    expect(() => validatePort(100000)).toThrow('Invalid port');
  });

  it('rejects non-integer values', () => {
    expect(() => validatePort(3001.5)).toThrow('Invalid port');
    expect(() => validatePort('abc')).toThrow('Invalid port');
    expect(() => validatePort(NaN)).toThrow('Invalid port');
  });
});
