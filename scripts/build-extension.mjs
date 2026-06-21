import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';

const client = readFileSync('./dist/client.js', 'utf8');

// Chrome (MV3) — extension/ folder
writeFileSync('./extension/content.js', client);
console.log('✓ extension/content.js');

// Firefox (MV2) — dist/extension-firefox/ folder with manifest.json
mkdirSync('./dist/extension-firefox/icons', { recursive: true });
const ffManifest = JSON.parse(readFileSync('./extension/manifest.firefox.json', 'utf8'));
ffManifest.background.scripts = ['background.js'];
writeFileSync('./dist/extension-firefox/manifest.json', JSON.stringify(ffManifest, null, 2));
writeFileSync('./dist/extension-firefox/content.js', client);
writeFileSync('./dist/extension-firefox/background.js', readFileSync('./extension/background.firefox.js', 'utf8'));
for (const size of [16, 32, 48, 128]) {
  copyFileSync(`./extension/icons/icon${size}.png`, `./dist/extension-firefox/icons/icon${size}.png`);
}
console.log('✓ dist/extension-firefox/');
