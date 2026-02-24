import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectFramework, detectPackageManager, getStartCommand, detectEnvFiles } from '../lib/detect.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'spun-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writePkg(deps = {}, devDeps = {}) {
  writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
    name: 'test-app',
    dependencies: deps,
    devDependencies: devDeps,
  }));
}

describe('detectFramework', () => {
  it('detects Next.js', () => {
    writePkg({ next: '^14.0.0', react: '^18.0.0' });
    const fw = detectFramework(tmpDir);
    expect(fw.name).toBe('next');
    expect(fw.label).toBe('Next.js');
  });

  it('detects TanStack Start', () => {
    writePkg({ '@tanstack/start': '^1.0.0', '@tanstack/react-router': '^1.0.0' });
    const fw = detectFramework(tmpDir);
    expect(fw.name).toBe('tanstack-start');
  });

  it('detects Remix via @remix-run/node', () => {
    writePkg({ '@remix-run/node': '^2.0.0', react: '^18.0.0' });
    const fw = detectFramework(tmpDir);
    expect(fw.name).toBe('remix');
  });

  it('detects Remix via @remix-run/serve', () => {
    writePkg({ '@remix-run/serve': '^2.0.0', react: '^18.0.0' });
    const fw = detectFramework(tmpDir);
    expect(fw.name).toBe('remix');
  });

  it('detects Nuxt', () => {
    writePkg({}, { nuxt: '^3.0.0' });
    const fw = detectFramework(tmpDir);
    expect(fw.name).toBe('nuxt');
  });

  it('detects SvelteKit', () => {
    writePkg({}, { '@sveltejs/kit': '^2.0.0' });
    const fw = detectFramework(tmpDir);
    expect(fw.name).toBe('sveltekit');
  });

  it('returns null for plain Node.js app', () => {
    writePkg({ express: '^4.0.0' });
    const fw = detectFramework(tmpDir);
    expect(fw).toBeNull();
  });

  it('returns null when no package.json', () => {
    const fw = detectFramework(tmpDir);
    expect(fw).toBeNull();
  });

  it('prefers Next.js over Remix when both present (order priority)', () => {
    writePkg({ next: '^14.0.0', '@remix-run/node': '^2.0.0' });
    const fw = detectFramework(tmpDir);
    expect(fw.name).toBe('next');
  });

  it('detects framework in devDependencies', () => {
    writePkg({}, { next: '^14.0.0' });
    const fw = detectFramework(tmpDir);
    expect(fw.name).toBe('next');
  });
});

describe('detectPackageManager', () => {
  it('detects bun from bun.lockb', () => {
    writeFileSync(join(tmpDir, 'bun.lockb'), '');
    const pm = detectPackageManager(tmpDir);
    expect(pm.name).toBe('bun');
    expect(pm.install).toContain('bun install');
  });

  it('detects bun from bun.lock', () => {
    writeFileSync(join(tmpDir, 'bun.lock'), '');
    const pm = detectPackageManager(tmpDir);
    expect(pm.name).toBe('bun');
  });

  it('detects pnpm from pnpm-lock.yaml', () => {
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');
    const pm = detectPackageManager(tmpDir);
    expect(pm.name).toBe('pnpm');
    expect(pm.install).toContain('pnpm install');
  });

  it('detects yarn from yarn.lock', () => {
    writeFileSync(join(tmpDir, 'yarn.lock'), '');
    const pm = detectPackageManager(tmpDir);
    expect(pm.name).toBe('yarn');
  });

  it('detects npm from package-lock.json', () => {
    writeFileSync(join(tmpDir, 'package-lock.json'), '{}');
    const pm = detectPackageManager(tmpDir);
    expect(pm.name).toBe('npm');
  });

  it('defaults to npm when no lockfile found', () => {
    const pm = detectPackageManager(tmpDir);
    expect(pm.name).toBe('npm');
  });

  it('prefers bun over pnpm when both present', () => {
    writeFileSync(join(tmpDir, 'bun.lockb'), '');
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');
    const pm = detectPackageManager(tmpDir);
    expect(pm.name).toBe('bun');
  });
});

describe('getStartCommand', () => {
  const npmPm = { name: 'npm', run: 'npm run' };
  const bunPm = { name: 'bun', run: 'bun run' };

  it('returns pm start for Next.js (non-standalone)', () => {
    writePkg({ next: '^14.0.0' });
    const cmd = getStartCommand({ name: 'next' }, npmPm, tmpDir);
    expect(cmd).toBe('npm run start');
  });

  it('returns standalone command for Next.js with standalone output', () => {
    writePkg({ next: '^14.0.0' });
    writeFileSync(join(tmpDir, 'next.config.js'), `module.exports = { output: 'standalone' }`);
    const cmd = getStartCommand({ name: 'next' }, npmPm, tmpDir);
    expect(cmd).toBe('node .next/standalone/server.js');
  });

  it('detects standalone in next.config.mjs', () => {
    writePkg({ next: '^14.0.0' });
    writeFileSync(join(tmpDir, 'next.config.mjs'), `export default { output: "standalone" }`);
    const cmd = getStartCommand({ name: 'next' }, npmPm, tmpDir);
    expect(cmd).toBe('node .next/standalone/server.js');
  });

  it('returns pm start for Remix', () => {
    const cmd = getStartCommand({ name: 'remix' }, bunPm, tmpDir);
    expect(cmd).toBe('bun run start');
  });

  it('returns fixed command for Nuxt', () => {
    const cmd = getStartCommand({ name: 'nuxt', startCmd: 'node .output/server/index.mjs' }, npmPm, tmpDir);
    expect(cmd).toBe('node .output/server/index.mjs');
  });

  it('returns fixed command for SvelteKit', () => {
    const cmd = getStartCommand({ name: 'sveltekit', startCmd: 'node build/index.js' }, npmPm, tmpDir);
    expect(cmd).toBe('node build/index.js');
  });

  it('returns pm start for null framework', () => {
    const cmd = getStartCommand(null, npmPm, tmpDir);
    expect(cmd).toBe('npm run start');
  });
});

describe('detectEnvFiles', () => {
  it('finds .env files that exist', () => {
    writeFileSync(join(tmpDir, '.env'), 'KEY=value');
    writeFileSync(join(tmpDir, '.env.production'), 'KEY=prod');
    const files = detectEnvFiles(tmpDir);
    expect(files).toEqual(['.env', '.env.production']);
  });

  it('returns empty array when no env files', () => {
    const files = detectEnvFiles(tmpDir);
    expect(files).toEqual([]);
  });

  it('finds .env.local and .env.production.local', () => {
    writeFileSync(join(tmpDir, '.env.local'), 'SECRET=local');
    writeFileSync(join(tmpDir, '.env.production.local'), 'SECRET=prod');
    const files = detectEnvFiles(tmpDir);
    expect(files).toEqual(['.env.local', '.env.production.local']);
  });
});
