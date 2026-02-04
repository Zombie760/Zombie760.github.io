#!/usr/bin/env node

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

import { checkPrerequisites } from './lib/prerequisites.mjs';
import { setSecrets } from './lib/github.mjs';
import { setTelegramWebhook, validateBotToken } from './lib/telegram.mjs';

async function main() {
  console.log(chalk.bold('\nTelegram Setup\n'));

  // Check prerequisites
  const prereqs = await checkPrerequisites();

  if (!prereqs.git.remoteInfo) {
    console.log(chalk.red('Could not detect GitHub repository from git remote.'));
    process.exit(1);
  }

  const { owner, repo } = prereqs.git.remoteInfo;
  console.log(chalk.dim(`Repository: ${owner}/${repo}\n`));

  // Get Telegram bot token
  const { token } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'Telegram bot token:',
      mask: '*',
      validate: (input) => {
        if (!input) return 'Token is required';
        if (!/^\d+:[A-Za-z0-9_-]+$/.test(input)) {
          return 'Invalid format. Should be like 123456789:ABC-DEF...';
        }
        return true;
      },
    },
  ]);

  // Validate token
  const validateSpinner = ora('Validating bot token...').start();
  const validation = await validateBotToken(token);

  if (!validation.valid) {
    validateSpinner.fail(`Invalid token: ${validation.error}`);
    process.exit(1);
  }
  validateSpinner.succeed(`Bot: @${validation.botInfo.username}`);

  // Get ngrok URL
  const { url } = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Your ngrok URL (https://...):',
      validate: (input) => {
        if (!input) return 'URL is required';
        if (!input.startsWith('https://')) return 'URL must start with https://';
        return true;
      },
    },
  ]);

  const ngrokUrl = url.replace(/\/$/, '');

  // Set GH_WEBHOOK_URL secret
  const urlSpinner = ora('Setting GH_WEBHOOK_URL secret...').start();
  const urlResult = await setSecrets(owner, repo, { GH_WEBHOOK_URL: ngrokUrl });
  if (urlResult.GH_WEBHOOK_URL.success) {
    urlSpinner.succeed('GH_WEBHOOK_URL secret set');
  } else {
    urlSpinner.fail(`Failed: ${urlResult.GH_WEBHOOK_URL.error}`);
  }

  // Register Telegram webhook
  const webhookUrl = `${ngrokUrl}/telegram/webhook`;
  const tgSpinner = ora('Registering Telegram webhook...').start();
  const tgResult = await setTelegramWebhook(token, webhookUrl);
  if (tgResult.ok) {
    tgSpinner.succeed(`Webhook: ${webhookUrl}`);
  } else {
    tgSpinner.fail(`Failed: ${tgResult.description}`);
  }

  console.log(chalk.green('\nDone! Message your bot to create jobs.\n'));
}

main().catch((error) => {
  console.error(chalk.red('\nFailed:'), error.message);
  process.exit(1);
});
