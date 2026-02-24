import { describe, it, expect } from 'vitest';
import { upsertAppBlock, removeAppBlock } from '../lib/caddy.js';

const BASE_CADDYFILE = `# spun: Base configuration
spun.run {
    respond "spun: Visit <app>.spun.run" 200
}`;

describe('upsertAppBlock', () => {
  it('appends a new block to the Caddyfile', () => {
    const result = upsertAppBlock(BASE_CADDYFILE, 'myapp', 3001, 'spun.run');
    expect(result).toContain('myapp.spun.run {');
    expect(result).toContain('reverse_proxy localhost:3001');
    expect(result).toContain('}');
  });

  it('preserves existing content when appending', () => {
    const result = upsertAppBlock(BASE_CADDYFILE, 'myapp', 3001, 'spun.run');
    expect(result).toContain('spun.run {');
    expect(result).toContain('respond "spun: Visit <app>.spun.run" 200');
  });

  it('replaces an existing block with same subdomain', () => {
    const withApp = upsertAppBlock(BASE_CADDYFILE, 'myapp', 3001, 'spun.run');
    const updated = upsertAppBlock(withApp, 'myapp', 3005, 'spun.run');
    expect(updated).toContain('reverse_proxy localhost:3005');
    expect(updated).not.toContain('reverse_proxy localhost:3001');
  });

  it('handles multiple app blocks', () => {
    let result = upsertAppBlock(BASE_CADDYFILE, 'app1', 3001, 'spun.run');
    result = upsertAppBlock(result, 'app2', 3002, 'spun.run');
    expect(result).toContain('app1.spun.run {');
    expect(result).toContain('app2.spun.run {');
    expect(result).toContain('reverse_proxy localhost:3001');
    expect(result).toContain('reverse_proxy localhost:3002');
  });

  it('produces properly formatted blocks', () => {
    const result = upsertAppBlock(BASE_CADDYFILE, 'test', 4000, 'spun.run');
    expect(result).toContain('test.spun.run {\n    reverse_proxy localhost:4000\n}');
  });

  it('handles empty Caddyfile content', () => {
    const result = upsertAppBlock('', 'myapp', 3001, 'spun.run');
    expect(result).toContain('myapp.spun.run {');
    expect(result).toContain('reverse_proxy localhost:3001');
  });
});

describe('removeAppBlock', () => {
  it('removes an existing app block', () => {
    let caddyfile = upsertAppBlock(BASE_CADDYFILE, 'myapp', 3001, 'spun.run');
    const result = removeAppBlock(caddyfile, 'myapp', 'spun.run');
    expect(result).not.toContain('myapp.spun.run');
    expect(result).not.toContain('reverse_proxy localhost:3001');
  });

  it('preserves other blocks when removing one', () => {
    let caddyfile = upsertAppBlock(BASE_CADDYFILE, 'app1', 3001, 'spun.run');
    caddyfile = upsertAppBlock(caddyfile, 'app2', 3002, 'spun.run');
    const result = removeAppBlock(caddyfile, 'app1', 'spun.run');
    expect(result).not.toContain('app1.spun.run');
    expect(result).toContain('app2.spun.run {');
    expect(result).toContain('reverse_proxy localhost:3002');
  });

  it('preserves base config when removing app', () => {
    let caddyfile = upsertAppBlock(BASE_CADDYFILE, 'myapp', 3001, 'spun.run');
    const result = removeAppBlock(caddyfile, 'myapp', 'spun.run');
    expect(result).toContain('spun.run {');
    expect(result).toContain('respond');
  });

  it('handles removing non-existent block gracefully', () => {
    const result = removeAppBlock(BASE_CADDYFILE, 'nonexistent', 'spun.run');
    expect(result).toBe(BASE_CADDYFILE);
  });
});
