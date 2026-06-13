import { createRequire } from 'module';
import { writeFileSync } from 'fs';

const require = createRequire(import.meta.url);
const { getClientScript } = require('../dist/index.cjs');

const code = getClientScript({});
writeFileSync('./dist/client.js', code);
console.log('✓ dist/client.js');

// CDN-based bookmarklet — loads client.js from unpkg after publish
const cdnBookmarklet = `javascript:(function(){if(window.__specter)return;var s=document.createElement('script');s.src='https://unpkg.com/vite-plugin-specter/dist/client.js';document.body.appendChild(s);})();`;
writeFileSync('./dist/bookmarklet.txt', cdnBookmarklet);
console.log('✓ dist/bookmarklet.txt');
