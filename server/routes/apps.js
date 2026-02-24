import { Hono } from 'hono';
import { execSync, execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { readRegistry, writeRegistry } from '../lib/registry.js';
import { removeCaddyBlock } from '../lib/caddy.js';

const APPS_DIR = '/srv/apps';

const app = new Hono();

function isAdmin(c) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  return token && token === process.env.ADMIN_TOKEN;
}

function getClientTokens(c) {
  const header = c.req.header('X-Tokens');
  if (!header) return {};
  try {
    return JSON.parse(header);
  } catch {
    return {};
  }
}

function isAuthorized(c, appEntry) {
  if (isAdmin(c)) return true;
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  return token && appEntry.secret && token === appEntry.secret;
}

// GET /apps — list only apps the caller owns
app.get('/apps', (c) => {
  const registry = readRegistry();
  const tokens = getClientTokens(c);

  // Get PM2 status
  let pm2Status = {};
  try {
    const raw = execSync('pm2 jlist 2>/dev/null || echo "[]"', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const processes = JSON.parse(raw);
    for (const proc of processes) {
      pm2Status[proc.name] = proc.pm2_env?.status || 'unknown';
    }
  } catch { /* ignore */ }

  const admin = isAdmin(c);

  const apps = Object.entries(registry.apps)
    .filter(([name, entry]) => {
      if (admin) return true;
      return tokens[name] && entry.secret && tokens[name] === entry.secret;
    })
    .map(([name, entry]) => ({
      name,
      url: entry.subdomain ? `https://${entry.subdomain}` : null,
      port: entry.port,
      framework: entry.framework || 'node',
      status: pm2Status[name] || 'stopped',
      expiresAt: entry.expiresAt || null,
      permanent: entry.permanent || false,
      deployedAt: entry.deployedAt || null,
    }));

  return c.json({ apps });
});

// DELETE /apps/:name — remove an app (requires matching token)
app.delete('/apps/:name', (c) => {
  const name = c.req.param('name');
  const registry = readRegistry();

  if (!registry.apps[name]) {
    return c.json({ error: `App "${name}" not found` }, 404);
  }

  if (!isAuthorized(c, registry.apps[name])) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Stop PM2
  try {
    execFileSync('pm2', ['delete', name], { stdio: 'pipe' });
    execSync('pm2 save', { stdio: 'pipe' });
  } catch { /* not running */ }

  // Remove files
  try {
    rmSync(join(APPS_DIR, name), { recursive: true, force: true });
  } catch { /* ignore */ }

  // Remove Caddy block
  try {
    removeCaddyBlock(name);
  } catch { /* ignore */ }

  // Remove from registry
  delete registry.apps[name];
  writeRegistry(registry);

  return c.json({ removed: name });
});

// GET /apps/:name/logs — fetch logs (requires matching token)
app.get('/apps/:name/logs', (c) => {
  const name = c.req.param('name');
  const registry = readRegistry();

  if (!registry.apps[name]) {
    return c.text('App not found', 404);
  }

  if (!isAuthorized(c, registry.apps[name])) {
    return c.text('Unauthorized', 401);
  }

  const lines = Math.min(Math.max(parseInt(c.req.query('lines'), 10) || 50, 1), 5000);

  try {
    const logs = execFileSync('pm2', ['logs', name, '--nostream', '--lines', String(lines)], {
      encoding: 'utf-8',
      timeout: 5000,
    });
    return c.text(logs);
  } catch (err) {
    return c.text(err.stdout || err.message || 'No logs available', 500);
  }
});

export default app;
