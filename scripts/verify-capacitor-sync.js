const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.cwd();
const buildJsDir = path.join(root, 'build', 'static', 'js');
const iosJsDir = path.join(root, 'ios', 'App', 'App', 'public', 'static', 'js');

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

const buildBundle = latestMainBundle(buildJsDir);
if (!buildBundle) {
  console.error('❌ No built web bundle found. Run `npm run build:cap` first.');
  process.exit(1);
}

const iosBundle = latestMainBundle(iosJsDir);
if (!iosBundle) {
  console.error('❌ No iOS web bundle found. Run `npm run cap:sync:ios` first.');
  process.exit(1);
}

const buildHash = sha256(buildBundle.fullPath);
const iosHash = sha256(iosBundle.fullPath);

console.log(`build bundle: ${path.relative(root, buildBundle.fullPath)}`);
console.log(`ios bundle:   ${path.relative(root, iosBundle.fullPath)}`);
console.log(`build hash:   ${buildHash}`);
console.log(`ios hash:     ${iosHash}`);

if (buildHash !== iosHash) {
  console.error('\n❌ iOS app is not using the latest web build.');
  console.error('   Run: npm run build:cap && npm run cap:sync:ios');
  console.error('   Then in Xcode: Product > Clean Build Folder, and rebuild the app.');
  process.exit(1);
}

console.log('\n✅ iOS web assets match the latest build output.');
