import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FRAMEWORKS = [
  {
    name: 'next',
    label: 'Next.js',
    dep: 'next',
    startCmd: null, // determined dynamically
    buildOutput: '.next',
  },
  {
    name: 'tanstack-start',
    label: 'TanStack Start',
    dep: '@tanstack/start',
    startCmd: 'node .output/server/index.mjs',
    buildOutput: '.output',
  },
  {
    name: 'remix',
    label: 'Remix',
    dep: '@remix-run/node',
    startCmd: null, // uses pm start
    buildOutput: 'build',
  },
  {
    name: 'nuxt',
    label: 'Nuxt',
    dep: 'nuxt',
    startCmd: 'node .output/server/index.mjs',
    buildOutput: '.output',
  },
  {
    name: 'sveltekit',
    label: 'SvelteKit',
    dep: '@sveltejs/kit',
    startCmd: 'node build/index.js',
    buildOutput: 'build',
  },
  {
    name: 'astro',
    label: 'Astro',
    dep: 'astro',
    startCmd: 'node dist/server/entry.mjs',
    buildOutput: 'dist',
  },
  {
    name: 'solidstart',
    label: 'SolidStart',
    dep: '@solidjs/start',
    startCmd: 'node .output/server/index.mjs',
    buildOutput: '.output',
  },
];

export function detectFramework(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const fw of FRAMEWORKS) {
    if (allDeps[fw.dep]) {
      return { ...fw };
    }
    // Alternate dep names
    if (fw.name === 'remix' && allDeps['@remix-run/serve']) return { ...fw };
    if (fw.name === 'tanstack-start' && allDeps['@tanstack/react-start']) return { ...fw };
    if (fw.name === 'solidstart' && allDeps['solid-start']) return { ...fw };
  }

  return null;
}

export function detectPackageManager(dir) {
  const checks = [
    { files: ['bun.lockb', 'bun.lock'], name: 'bun', install: 'bun install --production', build: 'bun run build', run: 'bun run' },
    { files: ['pnpm-lock.yaml'], name: 'pnpm', install: 'pnpm install --prod', build: 'pnpm run build', run: 'pnpm run' },
    { files: ['yarn.lock'], name: 'yarn', install: 'yarn install --production', build: 'yarn run build', run: 'yarn run' },
    { files: ['package-lock.json'], name: 'npm', install: 'npm install --omit=dev', build: 'npm run build', run: 'npm run' },
  ];

  for (const pm of checks) {
    if (pm.files.some((f) => existsSync(join(dir, f)))) {
      return { name: pm.name, install: pm.install, build: pm.build, run: pm.run };
    }
  }

  // Default to npm
  return { name: 'npm', install: 'npm install --omit=dev', build: 'npm run build', run: 'npm run' };
}

function isStandaloneNext(dir) {
  const configFiles = ['next.config.js', 'next.config.mjs', 'next.config.ts'];
  for (const file of configFiles) {
    const configPath = join(dir, file);
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        if (/output\s*[:=]\s*['"]standalone['"]/.test(content)) {
          return true;
        }
      } catch { /* ignore */ }
    }
  }
  return false;
}

export function getStartCommand(framework, pm, dir) {
  if (!framework) {
    return `${pm.run} start`;
  }

  if (framework.name === 'next') {
    if (isStandaloneNext(dir)) {
      return 'node .next/standalone/server.js';
    }
    return `${pm.run} start`;
  }

  if (framework.name === 'remix') {
    return `${pm.run} start`;
  }

  // TanStack Start, Nuxt, SvelteKit have fixed start commands
  return framework.startCmd || `${pm.run} start`;
}

export function detectEnvFiles(dir) {
  const envFiles = ['.env', '.env.production', '.env.local', '.env.production.local'];
  return envFiles.filter((f) => existsSync(join(dir, f)));
}
