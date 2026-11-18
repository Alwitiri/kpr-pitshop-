// Generates the KPR app icon (red rounded square, white "KPR") as PNG + Windows ICO
// using only Node built-ins. Output: packaging/kpr.ico and src/app/icon.png
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const FONT = {
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
};

function draw(size) {
  const px = new Uint8Array(size * size * 4);
  const r = size * 0.2; // corner radius
  const inside = (x, y) => {
    const cx = Math.min(Math.max(x, r), size - 1 - r);
    const cy = Math.min(Math.max(y, r), size - 1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const i = (y * size + x) * 4;
      px[i] = 0xdc; px[i + 1] = 0x26; px[i + 2] = 0x26; px[i + 3] = 255;
    }
  // text: 3 letters of 5 cols + 2 gaps of 1 col = 17 cols, 7 rows
  const cell = Math.floor((size * 0.78) / 17);
  const w = cell * 17, h = cell * 7;
  const ox = Math.floor((size - w) / 2), oy = Math.floor((size - h) / 2);
  [..."KPR"].forEach((ch, li) => {
    FONT[ch].forEach((row, ry) =>
      [...row].forEach((bit, rx) => {
        if (bit !== "1") return;
        for (let dy = 0; dy < cell; dy++)
          for (let dx = 0; dx < cell; dx++) {
            const x = ox + (li * 6 + rx) * cell + dx, y = oy + ry * cell + dy;
            const i = (y * size + x) * 4;
            px[i] = px[i + 1] = px[i + 2] = 255; px[i + 3] = 255;
          }
      }),
    );
  });
  return px;
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const px = draw(size);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const sizes = [16, 32, 48, 256];
const images = sizes.map(png);
const header = Buffer.alloc(6); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(images[i].length, 8); e.writeUInt32LE(offset, 12);
  offset += images[i].length;
  return e;
});
writeFileSync("packaging/kpr.ico", Buffer.concat([header, ...entries, ...images]));
writeFileSync("src/app/icon.png", png(256));
console.log("Wrote packaging/kpr.ico and src/app/icon.png");
