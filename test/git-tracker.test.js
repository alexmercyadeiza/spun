import { describe, it, expect } from 'vitest';
import { shouldDeploy } from '../lib/git-tracker.js';

describe('shouldDeploy', () => {
  it('returns not-a-git-repo when localCommit is null', () => {
    const result = shouldDeploy(null, 'abc123');
    expect(result).toEqual({ proceed: true, reason: 'not-a-git-repo' });
  });

  it('returns not-a-git-repo when localCommit is undefined', () => {
    const result = shouldDeploy(undefined, 'abc123');
    expect(result).toEqual({ proceed: true, reason: 'not-a-git-repo' });
  });

  it('returns first-deploy when registryCommit is null', () => {
    const result = shouldDeploy('abc123', null);
    expect(result).toEqual({ proceed: true, reason: 'first-deploy' });
  });

  it('returns first-deploy when registryCommit is undefined', () => {
    const result = shouldDeploy('abc123', undefined);
    expect(result).toEqual({ proceed: true, reason: 'first-deploy' });
  });

  it('returns same-commit when commits match', () => {
    const hash = 'a1b2c3d4e5f6789';
    const result = shouldDeploy(hash, hash);
    expect(result).toEqual({ proceed: false, reason: 'same-commit' });
  });

  it('returns new-commit when commits differ', () => {
    const result = shouldDeploy('abc123', 'def456');
    expect(result).toEqual({ proceed: true, reason: 'new-commit' });
  });

  it('returns not-a-git-repo when both are null (no git, no registry)', () => {
    const result = shouldDeploy(null, null);
    expect(result).toEqual({ proceed: true, reason: 'not-a-git-repo' });
  });
});
