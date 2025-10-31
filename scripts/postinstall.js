/*
  Conditional postinstall for monorepo-like structure.
  - If functions/package.json exists, install its deps (local dev/CI for Firebase Functions)
  - If not (e.g., Vercel build where functions/ is excluded), skip silently
*/

const fs = require('fs');
const { execSync } = require('child_process');

try {
  if (fs.existsSync('functions/package.json')) {
    console.log('[postinstall] Installing Firebase Functions dependencies...');
    execSync('npm --prefix functions install --no-fund --no-audit', {
      stdio: 'inherit',
      env: process.env,
    });
  } else {
    console.log('[postinstall] functions/package.json not found. Skipping functions install.');
  }
} catch (err) {
  console.error('[postinstall] Failed:', err);
  process.exit(1);
}


