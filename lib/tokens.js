import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const TOKENS_DIR = join(homedir(), '.spun');
const TOKENS_FILE = join(TOKENS_DIR, 'tokens.json');

export function loadTokens() {
  try {
    if (!existsSync(TOKENS_FILE)) return {};
    return JSON.parse(readFileSync(TOKENS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveToken(appName, token) {
  const tokens = loadTokens();
  tokens[appName] = token;
  mkdirSync(TOKENS_DIR, { recursive: true });
  writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2) + '\n');
}

export function getToken(appName) {
  return loadTokens()[appName] || null;
}

export function removeToken(appName) {
  const tokens = loadTokens();
  delete tokens[appName];
  mkdirSync(TOKENS_DIR, { recursive: true });
  writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2) + '\n');
}
