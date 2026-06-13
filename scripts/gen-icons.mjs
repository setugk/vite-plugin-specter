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

// Specter purple: #9B59B6
const [R, G, B] = [0x9b, 0x59, 0xb6];

function makePNG(size) {
  const cx = size / 2, cy = size / 2;
  const outerR = size / 2 - 0.5;
  // Simple ghost silhouette: rounded top + scalloped bottom
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // filter byte + RGBA per pixel
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      const dx = px - cx, dy = py - cy;
      let inside = false;

      const topHalf = py < cy;
      if (topHalf) {
        // Circular top half
        inside = dx * dx + dy * dy <= outerR * outerR;
      } else {
        // Rectangular bottom with scalloped edge
        const withinWidth = Math.abs(dx) <= outerR;
        // Scallop: 3 bumps at the bottom
        const scallops = 3;
        const scX = ((px / size) * scallops) % 1; // 0..1 within each scallop
        const scallopDepth = outerR * 0.25;
        const scallop = Math.sin(scX * Math.PI) * scallopDepth;
        const maxY = cy + outerR - scallop;
        inside = withinWidth && py <= maxY;
      }

      const off = 1 + x * 4;
      row[off]     = inside ? R : 0;
      row[off + 1] = inside ? G : 0;
      row[off + 2] = inside ? B : 0;
      row[off + 3] = inside ? 255 : 0;
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
