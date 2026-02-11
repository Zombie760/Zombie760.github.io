#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const command = process.argv[2];
const args = process.argv.slice(3);

function printUsage() {
  console.log(`
Usage: thepopebot <command>

Commands:
  init               Scaffold a new thepopebot project
  setup              Run interactive setup wizard
  setup-telegram     Reconfigure Telegram webhook
  reset [file]       Restore a template file (or list available templates)
`);
}

/**
 * Collect all template files as relative paths.
 */
function getTemplateFiles(templatesDir) {
  const files = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(path.relative(templatesDir, fullPath));
      }
    }
  }
  walk(templatesDir);
  return files;
}

function init() {
  const cwd = process.cwd();
  const packageDir = path.join(__dirname, '..');
  const templatesDir = path.join(packageDir, 'templates');

  console.log('\nScaffolding thepopebot project...\n');

  const templateFiles = getTemplateFiles(templatesDir);
  const created = [];
  const skipped = [];
  const changed = [];

  for (const relPath of templateFiles) {
    const src = path.join(templatesDir, relPath);
    const dest = path.join(cwd, relPath);

    if (!fs.existsSync(dest)) {
      // File doesn't exist — create it
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      created.push(relPath);
      console.log(`  Created ${relPath}`);
    } else {
      // File exists — check if template has changed
      const srcContent = fs.readFileSync(src);
      const destContent = fs.readFileSync(dest);
      if (srcContent.equals(destContent)) {
        skipped.push(relPath);
      } else {
        changed.push(relPath);
        console.log(`  Skipped ${relPath} (already exists)`);
      }
    }
  }

  // Create package.json if it doesn't exist
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    const dirName = path.basename(cwd);
    const pkg = {
      name: dirName,
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        setup: 'thepopebot setup',
        'setup-telegram': 'thepopebot setup-telegram',
      },
      dependencies: {
        thepopebot: '^1.0.0',
        next: '^16.0.0',
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('  Created package.json');
  } else {
    console.log('  Skipped package.json (already exists)');
  }

  // Create .gitkeep files for empty dirs
  const gitkeepDirs = ['cron', 'triggers', 'logs', 'tmp'];
  for (const dir of gitkeepDirs) {
    const gitkeep = path.join(cwd, dir, '.gitkeep');
    if (!fs.existsSync(gitkeep)) {
      fs.mkdirSync(path.join(cwd, dir), { recursive: true });
      fs.writeFileSync(gitkeep, '');
    }
  }

  // Report changed templates
  if (changed.length > 0) {
    console.log('\n  Updated templates available:');
    console.log('  These files differ from the current package templates.');
    console.log('  This may be from your edits, or from a thepopebot update.\n');
    for (const file of changed) {
      console.log(`    ${file}`);
    }
    console.log('\n  To view differences:  npx thepopebot diff <file>');
    console.log('  To reset to default:  npx thepopebot reset <file>');
  }

  // Run npm install
  console.log('\nInstalling dependencies...\n');
  execSync('npm install', { stdio: 'inherit', cwd });

  console.log('\nDone! Run: npm run setup\n');
}

/**
 * List all available template files, or restore a specific one.
 */
function reset(filePath) {
  const packageDir = path.join(__dirname, '..');
  const templatesDir = path.join(packageDir, 'templates');
  const cwd = process.cwd();

  if (!filePath) {
    console.log('\nAvailable template files:\n');
    const files = getTemplateFiles(templatesDir);
    for (const file of files) {
      console.log(`  ${file}`);
    }
    console.log('\nUsage: thepopebot reset <file>');
    console.log('Example: thepopebot reset operating_system/SOUL.md\n');
    return;
  }

  const src = path.join(templatesDir, filePath);
  const dest = path.join(cwd, filePath);

  if (!fs.existsSync(src)) {
    console.error(`\nTemplate not found: ${filePath}`);
    console.log('Run "thepopebot reset" to see available templates.\n');
    process.exit(1);
  }

  if (fs.statSync(src).isDirectory()) {
    console.log(`\nRestoring ${filePath}/...\n`);
    copyDirSyncForce(src, dest);
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`\nRestored ${filePath}\n`);
  }
}

/**
 * Show the diff between a user's file and the package template.
 */
function diff(filePath) {
  const packageDir = path.join(__dirname, '..');
  const templatesDir = path.join(packageDir, 'templates');
  const cwd = process.cwd();

  if (!filePath) {
    // Show all files that differ
    console.log('\nFiles that differ from package templates:\n');
    const files = getTemplateFiles(templatesDir);
    let anyDiff = false;
    for (const file of files) {
      const src = path.join(templatesDir, file);
      const dest = path.join(cwd, file);
      if (fs.existsSync(dest)) {
        const srcContent = fs.readFileSync(src);
        const destContent = fs.readFileSync(dest);
        if (!srcContent.equals(destContent)) {
          console.log(`  ${file}`);
          anyDiff = true;
        }
      } else {
        console.log(`  ${file} (missing)`);
        anyDiff = true;
      }
    }
    if (!anyDiff) {
      console.log('  All files match package templates.');
    }
    console.log('\nUsage: thepopebot diff <file>');
    console.log('Example: thepopebot diff operating_system/SOUL.md\n');
    return;
  }

  const src = path.join(templatesDir, filePath);
  const dest = path.join(cwd, filePath);

  if (!fs.existsSync(src)) {
    console.error(`\nTemplate not found: ${filePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(dest)) {
    console.log(`\n${filePath} does not exist in your project.`);
    console.log(`Run "thepopebot reset ${filePath}" to create it.\n`);
    return;
  }

  try {
    // Use git diff for nice colored output, fall back to plain diff
    execSync(`git diff --no-index -- "${dest}" "${src}"`, { stdio: 'inherit' });
    console.log('\nFiles are identical.\n');
  } catch (e) {
    // git diff exits with 1 when files differ (output already printed)
    console.log(`\n  To reset: thepopebot reset ${filePath}\n`);
  }
}

function copyDirSyncForce(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSyncForce(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  Restored ${path.relative(process.cwd(), destPath)}`);
    }
  }
}

function setup() {
  const setupScript = path.join(__dirname, '..', 'setup', 'setup.mjs');
  try {
    execSync(`node ${setupScript}`, { stdio: 'inherit', cwd: process.cwd() });
  } catch {
    process.exit(1);
  }
}

function setupTelegram() {
  const setupScript = path.join(__dirname, '..', 'setup', 'setup-telegram.mjs');
  try {
    execSync(`node ${setupScript}`, { stdio: 'inherit', cwd: process.cwd() });
  } catch {
    process.exit(1);
  }
}

switch (command) {
  case 'init':
    init();
    break;
  case 'setup':
    setup();
    break;
  case 'setup-telegram':
    setupTelegram();
    break;
  case 'reset':
    reset(args[0]);
    break;
  case 'diff':
    diff(args[0]);
    break;
  default:
    printUsage();
    process.exit(command ? 1 : 0);
}
