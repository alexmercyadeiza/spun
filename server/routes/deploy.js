import { Hono } from 'hono';
import { randomUUID, randomBytes } from 'node:crypto';
import { enqueue } from '../lib/queue.js';
import { build, getDeployStatus, setDeployStatus } from '../lib/builder.js';
import { readRegistry } from '../lib/registry.js';
import { logDeploy } from '../lib/analytics.js';

const app = new Hono();

// POST /deploy — upload tarball + metadata
app.post('/deploy', async (c) => {
  const formData = await c.req.formData();

  const tarball = formData.get('tarball');
  const name = formData.get('name');
  const framework = formData.get('framework') || null;
  const packageManager = formData.get('packageManager') || 'npm';
  const startCommand = formData.get('startCommand') || null;
  const gitCommit = formData.get('gitCommit') || null;
  const gitAuthor = formData.get('gitAuthor') || null;

  if (!tarball || !name) {
    return c.json({ error: 'Missing required fields: tarball, name' }, 400);
  }

  // Validate name
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) || name.length > 63) {
    return c.json({ error: 'Invalid app name' }, 400);
  }

  // Check if name is taken by someone else
  const registry = readRegistry();
  const existing = registry.apps[name];
  if (existing?.secret) {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    const isAdmin = token && token === process.env.ADMIN_TOKEN;
    const isOwner = token && token === existing.secret;
    if (!isAdmin && !isOwner) {
      const suffix = randomBytes(2).toString('hex');
      return c.json({
        error: `Name "${name}" is taken. Try "${name}-${suffix}"`,
        suggestion: `${name}-${suffix}`,
      }, 409);
    }
  }

  // Check tarball size (10MB max)
  const buffer = Buffer.from(await tarball.arrayBuffer());
  if (buffer.length > 10 * 1024 * 1024) {
    return c.json({ error: 'Tarball exceeds 10MB limit' }, 400);
  }

  const deployId = randomUUID();

  // Client IP — check forwarded headers (Caddy sets these)
  const ip = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
    || c.req.header('X-Real-IP')
    || 'unknown';

  // Log deploy attempt
  logDeploy({
    ip,
    name,
    framework,
    packageManager,
    tarballSize: buffer.length,
    gitCommit,
    gitAuthor,
    deployId,
  });

  setDeployStatus(deployId, {
    deployId,
    name,
    status: 'queued',
  });

  // Queue the build
  enqueue(() =>
    build(deployId, buffer, {
      name,
      framework,
      packageManager,
      startCommand,
      gitCommit,
      gitAuthor,
    })
  ).catch(() => {
    // Error already stored in deploy status by builder
  });

  return c.json(
    {
      deployId,
      name,
      statusUrl: `/deploy/${deployId}/status`,
    },
    202
  );
});

// GET /deploy/:id/status — poll build progress
app.get('/deploy/:id/status', (c) => {
  const deployId = c.req.param('id');
  const status = getDeployStatus(deployId);

  if (!status) {
    return c.json({ error: 'Deploy not found' }, 404);
  }

  return c.json(status);
});

export default app;
