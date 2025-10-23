/*
  Generate app icons from an embedded SVG approximation of the YamaGo logo.
  Outputs:
  - public/icons/icon-512x512.png
  - public/icons/icon-192x192.png
  - public/favicon.png (32x32)
  - public/favicon.ico (32x32 png as ico)
*/

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDirIcons = path.join(__dirname, '..', 'public', 'icons');
const outDirPublic = path.join(__dirname, '..', 'public');

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

  await sharp(base).resize(512, 512).png().toFile(path.join(outDirIcons, 'icon-512x512.png'));
  await sharp(base).resize(192, 192).png().toFile(path.join(outDirIcons, 'icon-192x192.png'));
  await sharp(base).resize(32, 32).png().toFile(path.join(outDirPublic, 'favicon.png'));
  await sharp(base).resize(32, 32).png().toFile(path.join(outDirPublic, 'favicon.ico'));

  console.log('Icons generated:');
  console.log(' - public/icons/icon-512x512.png');
  console.log(' - public/icons/icon-192x192.png');
  console.log(' - public/favicon.png');
  console.log(' - public/favicon.ico');
}

run().catch((e) => {
  console.error('Icon generation failed:', e);
  process.exit(1);
});


