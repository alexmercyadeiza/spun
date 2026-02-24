import { readFileSync, existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { detectFramework, detectPackageManager, getStartCommand } from './detect.js';
import { getLocalGitInfo, hasUncommittedChanges } from './git-tracker.js';
import { sanitizeAppName } from './validate.js';
import { createTarball, checkSourceSize } from './tarball.js';
import { postDeploy, pollStatus } from './client.js';
import { saveToken } from './tokens.js';
import { DEFAULT_DOMAIN } from './constants.js';

export async function deploy(appNameArg) {
  const dir = resolve('.');

  // 1. Detect framework
  const framework = detectFramework(dir);
  if (framework) {
    console.log(chalk.dim(`  Framework: ${framework.label}`));
  } else {
    console.log(chalk.dim('  Framework: none detected (generic Node.js app)'));
  }

  // 2. Detect package manager
  const pm = detectPackageManager(dir);
  console.log(chalk.dim(`  Package manager: ${pm.name}`));

  // 3. Derive app name
  let rawName = appNameArg;
  if (!rawName) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        rawName = pkg.name;
      } catch { /* ignore */ }
    }
  }
  if (!rawName) {
    rawName = basename(dir);
  }
  const appName = sanitizeAppName(rawName);

  // 4. Get start command
  const startCommand = getStartCommand(framework, pm, dir);

  // 5. Git info
  const gitInfo = getLocalGitInfo(dir);
  if (gitInfo.commit && hasUncommittedChanges(dir)) {
    console.log(chalk.yellow('  Warning: uncommitted changes (deploying HEAD)'));
  }

  // 6. Check source size
  const spinner = ora('Checking source size...').start();
  const sourceSize = checkSourceSize(dir);
  const sizeMB = (sourceSize / 1024 / 1024).toFixed(1);
  spinner.succeed(`Source: ${sizeMB}MB`);

  // 7. Create tarball
  const tarSpinner = ora('Creating tarball...').start();
  const tarball = createTarball(dir);
  const tarMB = (tarball.length / 1024 / 1024).toFixed(1);
  tarSpinner.succeed(`Tarball: ${tarMB}MB`);

  // 8. Summary
  const subdomain = `${appName}.${DEFAULT_DOMAIN}`;
  console.log('');
  console.log(chalk.bold(`  Deploy → ${chalk.cyan(`https://${subdomain}`)}`));
  if (gitInfo.commit) {
    console.log(chalk.dim(`  Commit: ${gitInfo.commit.slice(0, 7)}`));
  }
  console.log('');

  // 9. Upload
  const uploadSpinner = ora('Uploading...').start();
  let result;
  let finalName = appName;
  try {
    result = await postDeploy(tarball, {
      name: appName,
      framework: framework?.name || null,
      packageManager: pm.name,
      startCommand,
      gitCommit: gitInfo.commit || null,
      gitAuthor: gitInfo.deployedBy || null,
    });
  } catch (err) {
    if (err.suggestion) {
      // Name taken — retry with suggested name
      uploadSpinner.text = `Name taken, using ${err.suggestion}...`;
      finalName = err.suggestion;
      try {
        result = await postDeploy(tarball, {
          name: finalName,
          framework: framework?.name || null,
          packageManager: pm.name,
          startCommand,
          gitCommit: gitInfo.commit || null,
          gitAuthor: gitInfo.deployedBy || null,
        });
      } catch (retryErr) {
        uploadSpinner.fail('Upload failed');
        console.error(chalk.red(retryErr.message));
        process.exit(1);
      }
    } else {
      uploadSpinner.fail('Upload failed');
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  }
  uploadSpinner.succeed('Uploaded');

  // 10. Poll for status
  const buildSpinner = ora('Queued...').start();
  const { deployId } = result;

  const POLL_TIMEOUT = 5 * 60 * 1000; // 5 minutes max
  const pollStart = Date.now();
  let consecutiveErrors = 0;
  let status;

  while (true) {
    await new Promise((r) => setTimeout(r, 2000));

    if (Date.now() - pollStart > POLL_TIMEOUT) {
      buildSpinner.fail('Timed out');
      console.error(chalk.red('Deploy timed out after 5 minutes. The build may still be running on the server.'));
      process.exit(1);
    }

    try {
      status = await pollStatus(deployId);
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      if (consecutiveErrors >= 5) {
        buildSpinner.fail('Lost connection');
        console.error(chalk.red(err.message || 'Cannot reach server. Deploy may still be running.'));
        process.exit(1);
      }
      continue;
    }

    if (status.status === 'live') {
      buildSpinner.succeed('Live');
      if (status.secret) {
        saveToken(finalName, status.secret);
      }
      break;
    } else if (status.status === 'failed') {
      buildSpinner.fail('Deploy failed');
      console.error(chalk.red(status.error || 'Unknown error'));
      process.exit(1);
    } else {
      // Update spinner text with current phase
      const phase = status.status.charAt(0).toUpperCase() + status.status.slice(1);
      buildSpinner.text = `${phase}...`;
    }
  }

  // 11. Show result
  console.log('');
  console.log(chalk.green.bold('  Deployed successfully!'));
  console.log('');
  console.log(`  ${chalk.bold('URL:')}     ${chalk.cyan(status.url)}`);
  console.log(`  ${chalk.bold('Expires:')} ${new Date(status.expiresAt).toLocaleString()}`);
  console.log('');
  console.log(chalk.dim('  Commands:'));
  console.log(chalk.dim(`    spun ls`));
  console.log(chalk.dim(`    spun rm ${finalName}`));
  console.log('');
}
