import { API_URL } from './constants.js';
import { loadTokens, getToken } from './tokens.js';

export async function postDeploy(tarball, meta) {
  const form = new FormData();
  form.append('tarball', new Blob([tarball]), 'source.tar.gz');
  form.append('name', meta.name);
  if (meta.framework) form.append('framework', meta.framework);
  if (meta.packageManager) form.append('packageManager', meta.packageManager);
  if (meta.startCommand) form.append('startCommand', meta.startCommand);
  if (meta.gitCommit) form.append('gitCommit', meta.gitCommit);
  if (meta.gitAuthor) form.append('gitAuthor', meta.gitAuthor);

  const headers = {};
  const token = getToken(meta.name);
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/deploy`, {
    method: 'POST',
    body: form,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 409 && body.suggestion) {
      const err = new Error(body.error);
      err.suggestion = body.suggestion;
      throw err;
    }
    throw new Error(body.error || `Deploy failed: HTTP ${res.status}`);
  }

  return res.json();
}

export async function pollStatus(deployId) {
  const res = await fetch(`${API_URL}/deploy/${deployId}/status`);
  if (!res.ok) {
    throw new Error(`Status check failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function listApps() {
  const tokens = loadTokens();
  const res = await fetch(`${API_URL}/apps`, {
    headers: { 'X-Tokens': JSON.stringify(tokens) },
  });
  if (!res.ok) {
    throw new Error(`Failed to list apps: HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteApp(name) {
  const token = getToken(name);
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/apps/${name}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to remove app: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchLogs(name, lines = 50) {
  const token = getToken(name);
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/apps/${name}/logs?lines=${lines}`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch logs: HTTP ${res.status}`);
  }
  return res.text();
}
