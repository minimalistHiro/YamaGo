/*
  Generate app icons from an embedded SVG approximation of the YamaGo logo.
  Outputs:
  - Web PWA icons and favicons
  - iOS AppIcon set (overwrites existing PNGs referenced by Contents.json)
  - Android mipmap launcher icons (adaptive foreground + legacy/round)
*/

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDirIcons = path.join(__dirname, '..', 'public', 'icons');
const outDirPublic = path.join(__dirname, '..', 'public');
const iosAppIconDir = path.join(
  __dirname,
  '..',
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'AppIcon.appiconset'
);
const androidResDir = path.join(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'res'
);

if (!fs.existsSync(outDirIcons)) fs.mkdirSync(outDirIcons, { recursive: true });

// SVG representation inspired by the provided logo
const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#32c48d"/>
      <stop offset="100%" stop-color="#1e87ff"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <!-- simplified runner + gear silhouette (white) -->
  <g fill="#fff" transform="translate(40,28)">
    <circle cx="216" cy="210" r="150" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" stroke-dasharray="36 28"/>
    <g>
      <circle cx="216" cy="176" r="56"/>
      <path d="M185 146 l20 -30 20 30 z M227 146 l20 -30 20 30 z"/>
      <path d="M156 260 q60 -80 120 0 q-30 60 -60 120 q-40 10 -60 -10 q30 -60 60 -120 q-40 40 -60 10z"/>
      <rect x="120" y="240" width="36" height="80" rx="18" transform="rotate(-30 138 280)"/>
      <rect x="272" y="260" width="36" height="80" rx="18" transform="rotate(20 290 300)"/>
    </g>
  </g>
</svg>`;

async function run() {
  const base = await sharp(Buffer.from(svg)).png().toBuffer();

  // --- Web PWA icons ---
  await sharp(base).resize(512, 512).png().toFile(path.join(outDirIcons, 'icon-512x512.png'));
  await sharp(base).resize(192, 192).png().toFile(path.join(outDirIcons, 'icon-192x192.png'));
  await sharp(base).resize(32, 32).png().toFile(path.join(outDirPublic, 'favicon.png'));
  await sharp(base).resize(32, 32).png().toFile(path.join(outDirPublic, 'favicon.ico'));

  // --- iOS AppIcon set ---
  const iosTargets = [
    { filename: 'AppIcon-20@2x.png', size: 40 },
    { filename: 'AppIcon-20@3x.png', size: 60 },
    { filename: 'AppIcon-29@2x.png', size: 58 },
    { filename: 'AppIcon-29@3x.png', size: 87 },
    { filename: 'AppIcon-40@2x.png', size: 80 },
    { filename: 'AppIcon-40@3x.png', size: 120 },
    { filename: 'AppIcon-60@2x.png', size: 120 },
    { filename: 'AppIcon-60@3x.png', size: 180 },
    { filename: 'AppIcon-120@2x.png', size: 240 },
    { filename: 'AppIcon-152@2x.png', size: 304 },
    { filename: 'AppIcon-167@2x.png', size: 334 },
    { filename: 'AppIcon-512@2x.png', size: 1024 },
    { filename: 'AppIcon-1024.png', size: 1024 }
  ];
  for (const t of iosTargets) {
    const outPath = path.join(iosAppIconDir, t.filename);
    await sharp(base).resize(t.size, t.size).png().toFile(outPath);
  }

  // --- Android launcher icons ---
  const androidDensities = [
    { dir: 'mipmap-mdpi', legacy: 48, foreground: 108 },
    { dir: 'mipmap-hdpi', legacy: 72, foreground: 162 },
    { dir: 'mipmap-xhdpi', legacy: 96, foreground: 216 },
    { dir: 'mipmap-xxhdpi', legacy: 144, foreground: 324 },
    { dir: 'mipmap-xxxhdpi', legacy: 192, foreground: 432 }
  ];
  for (const d of androidDensities) {
    const dirPath = path.join(androidResDir, d.dir);
    await sharp(base).resize(d.legacy, d.legacy).png().toFile(path.join(dirPath, 'ic_launcher.png'));
    await sharp(base).resize(d.legacy, d.legacy).png().toFile(path.join(dirPath, 'ic_launcher_round.png'));
    await sharp(base).resize(d.foreground, d.foreground).png().toFile(path.join(dirPath, 'ic_launcher_foreground.png'));
  }

  console.log('Icons generated:');
  console.log(' - Web: public/icons/icon-512x512.png, icon-192x192.png, favicon.*');
  console.log(' - iOS: Assets.xcassets/AppIcon.appiconset/* (PNG files overwritten)');
  console.log(' - Android: res/mipmap-*/ic_launcher*.png (PNG files overwritten)');
}

run().catch((e) => {
  console.error('Icon generation failed:', e);
  process.exit(1);
});


