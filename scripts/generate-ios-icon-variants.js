#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
let sharp;
try {
  sharp = require('sharp');
} catch (_error) {
  console.error('Missing dependency: sharp. Run `npm install` (or add `sharp` as a dev dependency).');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const iconSetDir = path.join(rootDir, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
const contentsJsonPath = path.join(iconSetDir, 'Contents.json');

const baseIconName = 'AppIcon-512@2x.png';
const darkIconName = 'AppIcon-512@2x-dark.png';
const tintedIconName = 'AppIcon-512@2x-tinted.png';

async function ensureIconVariants() {
  const baseIconPath = path.join(iconSetDir, baseIconName);
  const darkIconPath = path.join(iconSetDir, darkIconName);
  const tintedIconPath = path.join(iconSetDir, tintedIconName);

  if (!fs.existsSync(baseIconPath)) {
    throw new Error(`Base icon not found: ${baseIconPath}`);
  }

  const darkBuffer = await sharp(baseIconPath)
    .negate({ alpha: false })
    .modulate({ saturation: 0.85, brightness: 0.92 })
    .png()
    .toBuffer();

  await sharp(darkBuffer).png().toFile(darkIconPath);
  await sharp(darkBuffer).greyscale().normalise().png().toFile(tintedIconPath);

  const contents = JSON.parse(fs.readFileSync(contentsJsonPath, 'utf8'));
  contents.images = [
    {
      idiom: 'universal',
      size: '1024x1024',
      filename: baseIconName,
      platform: 'ios',
    },
    {
      appearances: [{ appearance: 'luminosity', value: 'dark' }],
      idiom: 'universal',
      size: '1024x1024',
      filename: darkIconName,
      platform: 'ios',
    },
    {
      appearances: [{ appearance: 'luminosity', value: 'tinted' }],
      idiom: 'universal',
      size: '1024x1024',
      filename: tintedIconName,
      platform: 'ios',
    },
  ];

  fs.writeFileSync(contentsJsonPath, `${JSON.stringify(contents, null, 2)}\n`);

  console.log(`Generated iOS icon variants:
- ${darkIconName}
- ${tintedIconName}
Updated: ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json`);
}

ensureIconVariants().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
