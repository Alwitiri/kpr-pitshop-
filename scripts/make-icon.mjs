// Builds the software's app icon (Spoaxio) from the PNGs in packaging/icon:
//   packaging/kpr.ico  – desktop / Start-menu shortcut icon (installer uses this name)
//   src/app/favicon.ico – browser tab / Edge app-window icon
//   src/app/icon.png    – app icon for the browser and "install app"
// The PNGs (transparent background) come from the Spoaxio logo; 16–32 px use the "S" mark
// because the full badge text is unreadable that small. Uses only Node built-ins.
import { readFileSync, writeFileSync } from "node:fs";

const icon = (s) => readFileSync(`packaging/icon/spoaxio-${s}.png`);

/** Windows .ico that simply wraps PNG images (supported since Windows Vista). */
function ico(sizes) {
  const images = sizes.map(icon);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16);
    e[0] = s >= 256 ? 0 : s;
    e[1] = s >= 256 ? 0 : s;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(images[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += images[i].length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images]);
}

writeFileSync("packaging/kpr.ico", ico([16, 24, 32, 48, 64, 128, 256]));
writeFileSync("src/app/favicon.ico", ico([16, 24, 32, 48]));
writeFileSync("src/app/icon.png", icon(256));
console.log("Wrote Spoaxio icons: packaging/kpr.ico, src/app/favicon.ico, src/app/icon.png");
