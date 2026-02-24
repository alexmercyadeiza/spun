import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const REGISTRY_PATH = '/srv/apps/registry.json';

export function readRegistry() {
  try {
    if (!existsSync(REGISTRY_PATH)) return { apps: {} };
    return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
  } catch {
    return { apps: {} };
  }
}

export function writeRegistry(registry) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
}
