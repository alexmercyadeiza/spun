import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkSourceSize, createTarball } from '../lib/tarball.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'spun-tar-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('checkSourceSize', () => {
  it('returns 0 for empty directory', () => {
    expect(checkSourceSize(tmpDir)).toBe(0);
  });

  it('counts file sizes', () => {
    writeFileSync(join(tmpDir, 'index.js'), 'console.log("hello")');
    writeFileSync(join(tmpDir, 'package.json'), '{}');
    const size = checkSourceSize(tmpDir);
    expect(size).toBeGreaterThan(0);
  });

  it('excludes node_modules', () => {
    writeFileSync(join(tmpDir, 'index.js'), 'x');
    mkdirSync(join(tmpDir, 'node_modules', 'big-dep'), { recursive: true });
    writeFileSync(join(tmpDir, 'node_modules', 'big-dep', 'index.js'), 'a'.repeat(10000));
    const size = checkSourceSize(tmpDir);
    // Should only count index.js (1 byte), not the 10k in node_modules
    expect(size).toBeLessThan(100);
  });

  it('excludes .git directory', () => {
    writeFileSync(join(tmpDir, 'index.js'), 'x');
    mkdirSync(join(tmpDir, '.git', 'objects'), { recursive: true });
    writeFileSync(join(tmpDir, '.git', 'objects', 'pack'), 'a'.repeat(10000));
    const size = checkSourceSize(tmpDir);
    expect(size).toBeLessThan(100);
  });

  it('excludes build output dirs (.next, .output, build, dist)', () => {
    writeFileSync(join(tmpDir, 'index.js'), 'x');
    for (const dir of ['.next', '.output', 'build', 'dist']) {
      mkdirSync(join(tmpDir, dir), { recursive: true });
      writeFileSync(join(tmpDir, dir, 'bundle.js'), 'a'.repeat(10000));
    }
    const size = checkSourceSize(tmpDir);
    expect(size).toBeLessThan(100);
  });
});

describe('createTarball', () => {
  it('creates a tarball buffer from a directory', () => {
    writeFileSync(join(tmpDir, 'package.json'), '{"name":"test"}');
    writeFileSync(join(tmpDir, 'index.js'), 'console.log("hello")');
    const buffer = createTarball(tmpDir);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('throws when source exceeds 10MB', () => {
    // Create a file > 10MB
    writeFileSync(join(tmpDir, 'big.bin'), Buffer.alloc(11 * 1024 * 1024));
    expect(() => createTarball(tmpDir)).toThrow('exceeds 10MB limit');
  });

  it('excludes node_modules from tarball', () => {
    writeFileSync(join(tmpDir, 'index.js'), 'x');
    mkdirSync(join(tmpDir, 'node_modules', 'dep'), { recursive: true });
    writeFileSync(join(tmpDir, 'node_modules', 'dep', 'big.js'), 'a'.repeat(100000));
    const buffer = createTarball(tmpDir);
    // Tarball should be small since node_modules excluded (tar has ~10KB block overhead)
    expect(buffer.length).toBeLessThan(20000);
  });
});
