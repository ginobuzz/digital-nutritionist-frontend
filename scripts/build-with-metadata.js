const { execSync, spawnSync } = require('child_process');

function readGit(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_error) {
    return '';
  }
}

const commitHash = readGit('git rev-parse --short HEAD');
const commitDatetime = readGit('git log -1 --format=%cI');
const commitEpoch = readGit('git log -1 --format=%ct');

const env = {
  ...process.env,
  REACT_APP_BUILD_VERSION: process.env.REACT_APP_BUILD_VERSION || '0 (beta)',
  REACT_APP_BUILD_NUMBER: process.env.REACT_APP_BUILD_NUMBER || commitEpoch || 'unknown',
  REACT_APP_BUILD_DATETIME: process.env.REACT_APP_BUILD_DATETIME || commitDatetime || 'unknown',
  REACT_APP_BUILD_COMMIT: process.env.REACT_APP_BUILD_COMMIT || commitHash || 'unknown',
};

console.log(
  `[build-meta] version=${env.REACT_APP_BUILD_VERSION} build=${env.REACT_APP_BUILD_DATETIME} number=${env.REACT_APP_BUILD_NUMBER} commit=${env.REACT_APP_BUILD_COMMIT}`
);

const command = process.argv[2] || 'build';
const supported = new Set(['build', 'start']);

if (!supported.has(command)) {
  console.error(`[build-meta] Unsupported command "${command}". Use "build" or "start".`);
  process.exit(1);
}

const buildProcess = spawnSync('npx', ['craco', command], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (buildProcess.error) {
  console.error('[build-meta] Failed to start build process.');
  console.error(buildProcess.error.message);
  process.exit(1);
}

process.exit(buildProcess.status ?? 1);
