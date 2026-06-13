import { readFileSync, writeFileSync } from 'fs';

const client = readFileSync('./dist/client.js', 'utf8');
writeFileSync('./extension/content.js', client);
console.log('✓ extension/content.js');
