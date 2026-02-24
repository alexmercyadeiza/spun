import { Hono } from 'hono';
import { cors } from 'hono/cors';
import healthRoutes from './routes/health.js';
import deployRoutes from './routes/deploy.js';
import appsRoutes from './routes/apps.js';
import adminRoutes from './routes/admin.js';
import { startCleanupTimer } from './lib/cleanup.js';

const app = new Hono();

// CORS — allow CLI from anywhere
app.use('*', cors());

// Request logging
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
});

// Global error handler
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);
  return c.json({ error: 'Internal server error' }, 500);
});

// Routes
app.route('/', healthRoutes);
app.route('/', deployRoutes);
app.route('/', appsRoutes);
app.route('/', adminRoutes);

// Start cleanup timer
startCleanupTimer();

const port = Number(process.env.API_PORT) || 3100;

Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`spun-api listening on :${port}`);
