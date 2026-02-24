import { APP_NAME_REGEX, APP_NAME_MAX_LENGTH } from './constants.js';

export function sanitizeAppName(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('App name is required');
  }

  let name = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // replace non-alphanum with hyphens
    .replace(/-+/g, '-')          // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '');     // trim leading/trailing hyphens

  if (!name) {
    throw new Error(`Could not derive a valid app name from "${raw}"`);
  }

  if (name.length > APP_NAME_MAX_LENGTH) {
    name = name.slice(0, APP_NAME_MAX_LENGTH).replace(/-+$/, '');
  }

  if (!APP_NAME_REGEX.test(name)) {
    throw new Error(`Invalid app name "${name}". Must be lowercase alphanumeric with hyphens, not starting or ending with a hyphen.`);
  }

  return name;
}

export function validatePort(port) {
  const n = Number(port);
  if (!Number.isInteger(n) || n < 3001 || n > 65535) {
    throw new Error(`Invalid port ${port}. Must be an integer between 3001 and 65535.`);
  }
  return n;
}
