import { Hono } from 'hono';
import { readFileSync, existsSync } from 'node:fs';
import { readRegistry, writeRegistry } from '../lib/registry.js';

const app = new Hono();

// POST /admin/permanent — mark an app as permanent (no expiry)
app.post('/admin/permanent', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { name } = body;

  if (!name) {
    return c.json({ error: 'Missing name' }, 400);
  }

  const registry = readRegistry();
  if (!registry.apps[name]) {
    return c.json({ error: `App "${name}" not found` }, 404);
  }

  registry.apps[name].permanent = true;
  registry.apps[name].expiresAt = null;
  writeRegistry(registry);

  return c.json({ name, permanent: true });
});

// GET /admin/analytics — view deploy log
app.get('/admin/analytics', (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken || token !== adminToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const logFile = '/srv/spun-api/deploys.jsonl';
  if (!existsSync(logFile)) {
    return c.json({ deploys: [] });
  }

  const lines = readFileSync(logFile, 'utf-8').trim().split('\n').filter(Boolean);
  const last = c.req.query('last') || '50';
  const entries = lines.slice(-Number(last)).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);

  return c.json({ deploys: entries });
});

export default app;
