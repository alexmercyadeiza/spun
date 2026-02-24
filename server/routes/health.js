import { Hono } from 'hono';
import { readRegistry } from '../lib/registry.js';
import { queueLength } from '../lib/queue.js';

const app = new Hono();

app.get('/health', (c) => {
  const registry = readRegistry();
  const appCount = Object.keys(registry.apps).length;

  return c.json({
    ok: true,
    uptime: process.uptime(),
    apps: appCount,
    queueLength: queueLength(),
  });
});

// Caddy on_demand TLS permission check
app.get('/tls-check', (c) => {
  const domain = c.req.query('domain') || '';
  if (domain.endsWith('.spun.run')) {
    return c.text('OK', 200);
  }
  return c.text('Forbidden', 403);
});

export default app;
