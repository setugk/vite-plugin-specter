// Generates PNG icons for the browser extension using only Node.js built-ins.
// Run once: npm run gen-icons
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';

// CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function u32be(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  return Buffer.concat([u32be(data.length), t, data, u32be(crc32(Buffer.concat([t, data])))]);
}

// Specter purple: #AD24D3
const [R, G, B] = [0xAD, 0x24, 0xD3];

// Zap polygon in 24×24 coordinate space (matches client.ts SVG)
const ZAP = [[13,2],[3,14],[12,14],[11,22],[21,10],[12,10]];

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function makePNG(size) {
  const scale = size / 24;
  const poly = ZAP.map(([x, y]) => [x * scale, y * scale]);

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      // 4×4 supersampling for anti-aliased edges
      let hits = 0;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          if (pointInPolygon(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4, poly)) hits++;
        }
      }
      const alpha = Math.round((hits / 16) * 255);
      const off = 1 + x * 4;
      row[off]     = R;
      row[off + 1] = G;
      row[off + 2] = B;
      row[off + 3] = alpha;
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = pngChunk('IHDR', Buffer.concat([u32be(size), u32be(size), Buffer.from([8, 6, 0, 0, 0])]));
  const idat = pngChunk('IDAT', deflateSync(raw));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

mkdirSync('./extension/icons', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  writeFileSync(`./extension/icons/icon${size}.png`, makePNG(size));
  console.log(`✓ extension/icons/icon${size}.png`);
}
