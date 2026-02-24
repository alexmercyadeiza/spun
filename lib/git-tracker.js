import { execFileSync } from 'node:child_process';
import { userInfo } from 'node:os';
import { hostname } from 'node:os';

export function getLocalGitInfo(dir) {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const deployedBy = `${userInfo().username}@${hostname()}`;
    return { commit, deployedBy };
  } catch {
    return { commit: null, deployedBy: null };
  }
}

export function hasUncommittedChanges(dir) {
  try {
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: dir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

export function shouldDeploy(localCommit, registryCommit) {
  if (!localCommit) {
    return { proceed: true, reason: 'not-a-git-repo' };
  }

  if (!registryCommit) {
    return { proceed: true, reason: 'first-deploy' };
  }

  if (localCommit === registryCommit) {
    return { proceed: false, reason: 'same-commit' };
  }

  return { proceed: true, reason: 'new-commit' };
}
