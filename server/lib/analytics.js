import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const LOG_DIR = '/srv/spun-api';
const LOG_FILE = join(LOG_DIR, 'deploys.jsonl');

export function logDeploy(data) {
  try {
    const entry = {
      ts: new Date().toISOString(),
      ip: data.ip || null,
      name: data.name,
      framework: data.framework || null,
      packageManager: data.packageManager || null,
      tarballSize: data.tarballSize || 0,
      gitCommit: data.gitCommit || null,
      gitAuthor: data.gitAuthor || null,
      deployId: data.deployId,
    };
    appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch { /* don't crash on log failure */ }
}

export function logDeployResult(deployId, result) {
  try {
    const entry = {
      ts: new Date().toISOString(),
      deployId,
      result: result.status, // 'live' or 'failed'
      duration: result.duration || null,
      error: result.error || null,
    };
    appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch { /* ignore */ }
}
