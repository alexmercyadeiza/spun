import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', '.next', '.output', 'build', 'dist', '.svelte-kit',
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function checkSourceSize(dir) {
  let total = 0;

  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        total += statSync(full).size;
      }
    }
  }

  walk(dir);
  return total;
}

export function createTarball(dir) {
  const size = checkSourceSize(dir);
  if (size > MAX_SIZE) {
    const mb = (size / 1024 / 1024).toFixed(1);
    throw new Error(`Source size ${mb}MB exceeds 10MB limit. Ensure build artifacts are not included.`);
  }

  const excludes = [...EXCLUDE_DIRS].flatMap((d) => ['--exclude', d]);
  excludes.push('--exclude', '._*');

  const buffer = execFileSync('tar', ['czf', '-', ...excludes, '.'], {
    cwd: dir,
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  return buffer;
}
