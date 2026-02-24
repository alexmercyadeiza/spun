import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execSync, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { allocatePort } from './port-allocator.js';
import { readRegistry, writeRegistry } from './registry.js';
import { configureCaddy } from './caddy.js';
import { logDeployResult } from './analytics.js';

const APPS_DIR = '/srv/apps';
const DOMAIN = 'spun.run';

const deploys = new Map();

export function getDeployStatus(deployId) {
  return deploys.get(deployId) || null;
}

export function setDeployStatus(deployId, status) {
  deploys.set(deployId, status);
}

export async function build(deployId, tarballBuffer, meta) {
  const { name, framework, packageManager, startCommand, gitCommit, gitAuthor } = meta;
  const appDir = join(APPS_DIR, name);

  const startTime = Date.now();

  try {
    // 1. Extract
    setDeployStatus(deployId, { deployId, name, status: 'extracting' });

    // Stop existing PM2 process if redeploying
    try {
      execFileSync('pm2', ['describe', name], { stdio: 'pipe' });
      execFileSync('pm2', ['delete', name], { stdio: 'pipe' });
    } catch { /* not running */ }

    // Remove old dir if exists
    if (existsSync(appDir)) {
      rmSync(appDir, { recursive: true, force: true });
    }

    mkdirSync(appDir, { recursive: true });

    // Write tarball to temp file and extract
    const tarPath = join(APPS_DIR, `${deployId}.tar.gz`);
    writeFileSync(tarPath, tarballBuffer);
    execSync(`tar xzf ${tarPath} -C ${appDir}`, { stdio: 'pipe' });
    unlinkSync(tarPath);

    // 2. Install (all deps — devDependencies needed for build)
    setDeployStatus(deployId, { deployId, name, status: 'installing' });
    const pm = packageManager || 'npm';
    const installCmd = getInstallCommand(pm);
    execSync(`cd ${appDir} && ${installCmd}`, {
      stdio: 'pipe',
      timeout: 120_000,
    });

    // 3. Build
    setDeployStatus(deployId, { deployId, name, status: 'building' });
    const hasBuildScript = checkHasBuildScript(appDir);
    if (hasBuildScript) {
      const buildCmd = getBuildCommand(pm);
      execSync(`cd ${appDir} && ${buildCmd}`, {
        stdio: 'pipe',
        timeout: 180_000,
        env: { ...process.env, NODE_ENV: 'production' },
      });
    }

    // 4. Start
    setDeployStatus(deployId, { deployId, name, status: 'starting' });
    const registry = readRegistry();
    const port = allocatePort(registry, name);
    const startCmd = resolveStartCommand(appDir, startCommand, pm);

    const safeStartCmd = startCmd.replace(/'/g, "'\\''");
    execSync(
      `cd ${appDir} && PORT=${port} pm2 start '${safeStartCmd}' --name ${name} --max-restarts 3 --restart-delay 5000`,
      { stdio: 'pipe', env: { ...process.env, PORT: String(port) } }
    );
    execSync('pm2 save', { stdio: 'pipe' });

    // Wait for app to respond (up to 10s)
    let healthy = false;
    for (let i = 0; i < 10; i++) {
      try {
        execSync(`curl -s -o /dev/null -w '%{http_code}' http://localhost:${port}`, {
          stdio: 'pipe',
          timeout: 2000,
        });
        healthy = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // 5. Configure Caddy
    setDeployStatus(deployId, { deployId, name, status: 'configuring' });
    configureCaddy(name, port);

    // 6. Update registry
    const subdomain = `${name}.${DOMAIN}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const secret = randomBytes(16).toString('hex');
    const freshRegistry = readRegistry();
    freshRegistry.apps[name] = {
      port,
      framework: framework || 'node',
      subdomain,
      lastCommit: gitCommit || null,
      deployedAt: new Date().toISOString(),
      lastDeployedBy: gitAuthor || null,
      expiresAt,
      permanent: false,
      secret,
    };
    writeRegistry(freshRegistry);

    const url = `https://${subdomain}`;
    setDeployStatus(deployId, {
      deployId,
      name,
      status: 'live',
      url,
      expiresAt,
      secret,
    });

    logDeployResult(deployId, { status: 'live', duration: Date.now() - startTime });
    return { url, expiresAt, secret };
  } catch (err) {
    const errorMsg = err.stderr?.toString().slice(-500) || err.message;
    setDeployStatus(deployId, {
      deployId,
      name,
      status: 'failed',
      error: errorMsg,
    });
    logDeployResult(deployId, { status: 'failed', duration: Date.now() - startTime, error: errorMsg });
    throw err;
  }
}

function resolveStartCommand(appDir, clientStartCmd, pm) {
  // Auto-detect from build output (most reliable)
  const detections = [
    // Vinxi / TanStack Start / Nuxt / SolidStart / Analog (Nitro-based)
    { path: '.output/server/index.mjs', cmd: 'node .output/server/index.mjs' },
    // Next.js standalone
    { path: '.next/standalone/server.js', cmd: 'node .next/standalone/server.js' },
    // Remix v2 (remix-serve)
    { path: 'build/server/index.js', cmd: 'npx remix-serve build/server/index.js' },
    // Astro SSR (node adapter)
    { path: 'dist/server/entry.mjs', cmd: 'node dist/server/entry.mjs' },
    // SvelteKit node adapter
    { path: 'build/index.js', cmd: 'node build/index.js' },
  ];

  for (const { path, cmd } of detections) {
    if (existsSync(join(appDir, path))) {
      return cmd;
    }
  }

  // Use CLI-provided command if given
  if (clientStartCmd) return clientStartCmd;

  // Check if package.json has a start script
  try {
    const pkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf-8'));
    if (pkg.scripts?.start) {
      return `${pm === 'bun' ? 'bun run' : `${pm} run`} start`;
    }
  } catch { /* ignore */ }

  // Last resort
  return `${pm === 'bun' ? 'bun run' : `${pm} run`} start`;
}

function checkHasBuildScript(appDir) {
  try {
    const raw = readFileSync(join(appDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    return !!pkg.scripts?.build;
  } catch {
    return false;
  }
}

function getInstallCommand(pm) {
  switch (pm) {
    case 'bun': return 'bun install';
    case 'pnpm': return 'pnpm install';
    case 'yarn': return 'yarn install';
    default: return 'npm install';
  }
}

function getBuildCommand(pm) {
  switch (pm) {
    case 'bun': return 'bun run build';
    case 'pnpm': return 'pnpm run build';
    case 'yarn': return 'yarn run build';
    default: return 'npm run build';
  }
}
