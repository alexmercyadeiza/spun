import { describe, it, expect } from 'vitest';
import { allocatePort } from '../lib/registry.js';

describe('allocatePort', () => {
  it('returns 3001 for empty registry', () => {
    const registry = { apps: {} };
    expect(allocatePort(registry, 'myapp')).toBe(3001);
  });

  it('reuses existing port for the same app', () => {
    const registry = {
      apps: {
        myapp: { port: 3005, framework: 'next' },
      },
    };
    expect(allocatePort(registry, 'myapp')).toBe(3005);
  });

  it('allocates next port after existing apps', () => {
    const registry = {
      apps: {
        app1: { port: 3001 },
      },
    };
    expect(allocatePort(registry, 'newapp')).toBe(3002);
  });

  it('fills gaps in port allocation', () => {
    const registry = {
      apps: {
        app1: { port: 3001 },
        app3: { port: 3003 },
      },
    };
    // Should return 3002 (the gap)
    expect(allocatePort(registry, 'newapp')).toBe(3002);
  });

  it('skips all used ports', () => {
    const registry = {
      apps: {
        app1: { port: 3001 },
        app2: { port: 3002 },
        app3: { port: 3003 },
      },
    };
    expect(allocatePort(registry, 'newapp')).toBe(3004);
  });

  it('handles apps without port field', () => {
    const registry = {
      apps: {
        broken: { framework: 'next' },
        app1: { port: 3001 },
      },
    };
    expect(allocatePort(registry, 'newapp')).toBe(3002);
  });
});
