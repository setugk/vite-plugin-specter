import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';

const client = readFileSync('./dist/client.js', 'utf8');
const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

// Chrome (MV3) — dist/extension-chrome/
mkdirSync('./dist/extension-chrome/icons', { recursive: true });
const chromeManifest = JSON.parse(readFileSync('./extension/manifest.json', 'utf8'));
chromeManifest.version = version;
writeFileSync('./dist/extension-chrome/manifest.json', JSON.stringify(chromeManifest, null, 2));
writeFileSync('./dist/extension-chrome/content.js', client);
writeFileSync('./dist/extension-chrome/background.js', readFileSync('./extension/background.js', 'utf8'));
for (const size of [16, 32, 48, 128]) {
  copyFileSync(`./extension/icons/icon${size}.png`, `./dist/extension-chrome/icons/icon${size}.png`);
}
console.log('✓ dist/extension-chrome/');

// Also write content.js into extension/ for loading unpacked during dev
writeFileSync('./extension/content.js', client);
console.log('✓ extension/content.js (unpacked dev)');

// Firefox (MV2) — dist/extension-firefox/
mkdirSync('./dist/extension-firefox/icons', { recursive: true });
const ffManifest = JSON.parse(readFileSync('./extension/manifest.firefox.json', 'utf8'));
ffManifest.version = version;
ffManifest.background.scripts = ['background.js'];
writeFileSync('./dist/extension-firefox/manifest.json', JSON.stringify(ffManifest, null, 2));
writeFileSync('./dist/extension-firefox/content.js', client);
writeFileSync('./dist/extension-firefox/background.js', readFileSync('./extension/background.firefox.js', 'utf8'));
for (const size of [16, 32, 48, 128]) {
  copyFileSync(`./extension/icons/icon${size}.png`, `./dist/extension-firefox/icons/icon${size}.png`);
}
console.log('✓ dist/extension-firefox/');
