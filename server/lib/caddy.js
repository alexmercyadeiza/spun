import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CADDYFILE_PATH = '/etc/caddy/Caddyfile';
const DOMAIN = 'spun.run';

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function upsertAppBlock(content, appName, port) {
  const subdomain = `${appName}.${DOMAIN}`;
  const newBlock = `${subdomain} {\n\ttls {\n\t\ton_demand\n\t}\n\treverse_proxy localhost:${port}\n}`;

  // Match nested braces: outer { ... { ... } ... }
  const blockRegex = new RegExp(
    `${escapeRegex(subdomain)}\\s*\\{(?:[^{}]*\\{[^}]*\\})*[^}]*\\}`,
    's'
  );

  if (blockRegex.test(content)) {
    return content.replace(blockRegex, newBlock);
  }

  return content.trimEnd() + '\n\n' + newBlock + '\n';
}

export function removeAppBlock(content, appName) {
  const subdomain = `${appName}.${DOMAIN}`;
  // Match nested braces
  const blockRegex = new RegExp(
    `\\n*${escapeRegex(subdomain)}\\s*\\{(?:[^{}]*\\{[^}]*\\})*[^}]*\\}\\n?`,
    's'
  );
  return content.replace(blockRegex, '\n');
}

export function configureCaddy(appName, port) {
  const content = readFileSync(CADDYFILE_PATH, 'utf-8');
  const updated = upsertAppBlock(content, appName, port);
  writeFileSync(CADDYFILE_PATH, updated);
  execSync(`caddy validate --config ${CADDYFILE_PATH}`, { stdio: 'pipe' });
  execSync(`caddy reload --config ${CADDYFILE_PATH}`, { stdio: 'pipe' });
}

export function removeCaddyBlock(appName) {
  const content = readFileSync(CADDYFILE_PATH, 'utf-8');
  const updated = removeAppBlock(content, appName);
  writeFileSync(CADDYFILE_PATH, updated);
  try {
    execSync(`caddy validate --config ${CADDYFILE_PATH}`, { stdio: 'pipe' });
    execSync(`caddy reload --config ${CADDYFILE_PATH}`, { stdio: 'pipe' });
  } catch { /* ignore */ }
}
