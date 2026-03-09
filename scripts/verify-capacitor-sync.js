const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.cwd();
const buildJsDir = path.join(root, 'build', 'static', 'js');
const platform = (process.argv[2] || 'ios').trim().toLowerCase();

const platformConfig = {
  ios: {
    label: 'iOS',
    bundleDir: path.join(root, 'ios', 'App', 'App', 'public', 'static', 'js'),
    syncCommand: 'npm run cap:sync:ios',
    refreshCommand: 'npm run build:cap && npm run cap:sync:ios',
    studioHint: 'Then in Xcode: Product > Clean Build Folder, and rebuild the app.',
  },
  android: {
    label: 'Android',
    bundleDir: path.join(root, 'android', 'app', 'src', 'main', 'assets', 'public', 'static', 'js'),
    syncCommand: 'npm run cap:sync:android',
    refreshCommand: 'npm run build:cap && npm run cap:sync:android',
    studioHint: 'Then in Android Studio: Build > Clean Project, and rebuild/reinstall the app.',
  },
};

function latestMainBundle(dirPath) {
  if (!fs.existsSync(dirPath)) return null;

  const files = fs
    .readdirSync(dirPath)
    .filter((name) => /^main\.[^.]+\.js$/.test(name))
    .map((name) => {
      const fullPath = path.join(dirPath, name);
      return { name, fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files[0] ?? null;
}

function sha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

if (!platformConfig[platform]) {
  console.error(`❌ Unsupported platform '${platform}'. Use one of: ${Object.keys(platformConfig).join(', ')}.`);
  process.exit(1);
}

const target = platformConfig[platform];
const buildBundle = latestMainBundle(buildJsDir);
if (!buildBundle) {
  console.error('❌ No built web bundle found. Run `npm run build:cap` first.');
  process.exit(1);
}

const nativeBundle = latestMainBundle(target.bundleDir);
if (!nativeBundle) {
  console.error(`❌ No ${target.label} web bundle found. Run \`${target.syncCommand}\` first.`);
  process.exit(1);
}

const buildHash = sha256(buildBundle.fullPath);
const nativeHash = sha256(nativeBundle.fullPath);

console.log(`build bundle:   ${path.relative(root, buildBundle.fullPath)}`);
console.log(`${platform} bundle: ${path.relative(root, nativeBundle.fullPath)}`);
console.log(`build hash:     ${buildHash}`);
console.log(`${platform} hash:   ${nativeHash}`);

if (buildHash !== nativeHash) {
  console.error(`\n❌ ${target.label} app is not using the latest web build.`);
  console.error(`   Run: ${target.refreshCommand}`);
  console.error(`   ${target.studioHint}`);
  process.exit(1);
}

console.log(`\n✅ ${target.label} web assets match the latest build output.`);
