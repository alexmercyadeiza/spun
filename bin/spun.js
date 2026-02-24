#!/usr/bin/env node

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(`spun requires Node.js >= 18 (current: ${process.version})`);
  process.exit(1);
}

import { Command } from 'commander';
import chalk from 'chalk';
import { deploy } from '../lib/deploy.js';
import { listApps, deleteApp } from '../lib/client.js';
import { sanitizeAppName } from '../lib/validate.js';
import { removeToken } from '../lib/tokens.js';

const program = new Command();

program
  .name('spun')
  .description('Deploy SSR apps to spun.run')
  .version('2.0.0');

// Default action: deploy
program
  .argument('[name]', 'app name (optional)')
  .action(async (name) => {
    await deploy(name);
  });

// spun deploy [name]
program
  .command('deploy [name]')
  .description('Deploy current directory')
  .action(async (name) => {
    await deploy(name);
  });

// spun ls
program
  .command('ls')
  .description('List deployed apps')
  .action(async () => {
    try {
      const { apps } = await listApps();
      if (apps.length === 0) {
        console.log(chalk.dim('No apps deployed.'));
        return;
      }

      console.log('');
      console.log(chalk.bold('  App'.padEnd(22) + 'Status'.padEnd(12) + 'Expires'.padEnd(24) + 'URL'));
      console.log(chalk.dim('  ' + '\u2500'.repeat(76)));

      for (const app of apps) {
        const status = app.status === 'online' ? chalk.green(app.status) : chalk.red(app.status);
        const expires = app.permanent
          ? chalk.dim('permanent')
          : app.expiresAt
            ? new Date(app.expiresAt).toLocaleString()
            : '-';
        const url = app.url ? chalk.cyan(app.url) : '-';

        console.log(
          '  ' +
          chalk.white(app.name.padEnd(20)) +
          status.padEnd(12 + (status.length - app.status.length)) +
          String(expires).padEnd(24 + (String(expires).length - expires.length)) +
          url
        );
      }
      console.log('');
    } catch (err) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });

// spun rm <app>
program
  .command('rm <app>')
  .description('Remove a deployed app')
  .action(async (app) => {
    try {
      const appName = sanitizeAppName(app);
      const { removed } = await deleteApp(appName);
      removeToken(appName);
      console.log(chalk.green(`${removed} removed`));
    } catch (err) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });

try {
  await program.parseAsync();
} catch (err) {
  console.error(chalk.red(err.message));
  process.exit(1);
}
