import { execSync, execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { readRegistry, writeRegistry } from './registry.js';
import { removeCaddyBlock } from './caddy.js';

const APPS_DIR = '/srv/apps';

export function expireApps() {
  const registry = readRegistry();
  const now = Date.now();
  let changed = false;

  for (const [name, app] of Object.entries(registry.apps)) {
    if (app.permanent) continue;
    if (!app.expiresAt) continue;

    if (new Date(app.expiresAt).getTime() <= now) {
      console.log(`[cleanup] Expiring ${name}`);
      try {
        execFileSync('pm2', ['delete', name], { stdio: 'pipe' });
      } catch { /* not running */ }
      try {
        execSync('pm2 save', { stdio: 'pipe' });
      } catch { /* ignore */ }

      const appDir = join(APPS_DIR, name);
      try {
        rmSync(appDir, { recursive: true, force: true });
      } catch { /* ignore */ }

      try {
        removeCaddyBlock(name);
      } catch { /* ignore */ }

      delete registry.apps[name];
      changed = true;
    }
  }

  if (changed) {
    writeRegistry(registry);
  }
}

export function startCleanupTimer() {
  // Run immediately on startup
  expireApps();
  // Then every 5 minutes
  setInterval(expireApps, 5 * 60 * 1000);
}
