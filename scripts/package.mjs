// Builds the offline Windows package:
//   dist/Spoaxio-Software-<version>/            (folder you can copy on a pen drive)
//   dist/Spoaxio-Software-<version>.zip         (same, zipped)
// Contents: "Install Spoaxio Software.cmd", install.ps1, uninstall.ps1, program/ (app + node.exe + launcher)
import { execSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const name = `Spoaxio-Software-${pkg.version}`;
const out = path.join(root, "dist", name);
const program = path.join(out, "program");
const app = path.join(program, "app");
const run = (cmd) => execSync(cmd, { stdio: "inherit" });

rmSync(path.join(root, "dist"), { recursive: true, force: true });

console.log("1/6 Icon");
run("node scripts/make-icon.mjs");

console.log("2/6 Production build");
// Start from a clean build folder: leftover links from earlier builds / dev runs can't be overwritten on Windows
rmSync(path.join(root, ".next"), { recursive: true, force: true });
run("npx prisma generate");
run("npx next build");

console.log("3/6 Copy standalone server");
mkdirSync(app, { recursive: true });
cpSync(path.join(root, ".next", "standalone"), app, { recursive: true, dereference: true });
cpSync(path.join(root, ".next", "static"), path.join(app, ".next", "static"), { recursive: true });
if (existsSync(path.join(root, "public"))) cpSync(path.join(root, "public"), path.join(app, "public"), { recursive: true });
cpSync(path.join(root, "prisma", "migrations-sql"), path.join(app, "prisma", "migrations-sql"), { recursive: true });
// Never ship development settings / databases
for (const f of readdirSync(app)) if (f.startsWith(".env")) rmSync(path.join(app, f));
for (const f of [
  "prisma/dev.db", "prisma/dev.db-wal", "prisma/dev.db-shm", "prisma/backups", "prisma/uploads", "uploads",
  "src", "scripts", "packaging", "dist", "prisma/seed.ts", "package-lock.json", "README.md", "AGENTS.md",
]) {
  rmSync(path.join(app, f), { recursive: true, force: true });
}
// Turbopack links some packages via symlinks (e.g. .next/node_modules/@prisma/client-<hash>).
// ZIP files and robocopy drop symlinks, so replace every link with a real copy of its target.
let links = 0;
(function materialize(dir) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) {
      const target = realpathSync(p);
      rmSync(p, { recursive: true, force: true });
      cpSync(target, p, { recursive: true, dereference: true });
      links++;
      materialize(p);
    } else if (st.isDirectory()) {
      materialize(p);
    }
  }
})(app);
console.log(`   replaced ${links} symlinks with real folders`);
// Prisma leaves 21 MB "query_engine-*.node.tmpNNNN" copies when it can't replace a locked engine
// (e.g. dev server running). They are never used – don't ship them.
let junk = 0;
(function dropTmp(dir) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (lstatSync(p).isDirectory()) dropTmp(p);
    else if (/\.node\.tmp\d*$/.test(entry)) {
      rmSync(p, { force: true });
      junk++;
    }
  }
})(app);
if (junk) console.log(`   removed ${junk} leftover Prisma engine temp files`);
const engine = execSync(`dir /s /b "${app}\\*query_engine*.node"`, { encoding: "utf8", shell: "cmd.exe" }).trim();
if (!engine) throw new Error("Prisma query engine missing from standalone output");
console.log("   prisma engine:", path.relative(app, engine.split(/\r?\n/)[0]));

console.log("4/6 Bundle Node.js runtime", process.version);
mkdirSync(path.join(program, "node"), { recursive: true });
cpSync(process.execPath, path.join(program, "node", "node.exe"));

console.log("5/6 Launcher & installer");
const crlf = (s) => s.replace(/\r?\n/g, "\r\n");
for (const f of ["launcher.js", "kpr.ico", "allow-network.ps1"]) cpSync(path.join(root, "packaging", f), path.join(program, f));
writeFileSync(path.join(program, "Spoaxio Software.vbs"), crlf(readFileSync("packaging/Spoaxio Software.vbs", "utf8")));
for (const f of ["install.ps1", "uninstall.ps1", "Install Spoaxio Software.cmd"]) {
  writeFileSync(path.join(out, f), crlf(readFileSync(path.join("packaging", f), "utf8")));
}
writeFileSync(
  path.join(out, "README.txt"),
  crlf(`Spoaxio Software ${pkg.version} - offline business software

INSTALL / UPDATE
  1. Copy this whole folder to the shop PC (pen drive is fine).
  2. Right-click "Install Spoaxio Software.cmd" > Run as administrator
     (administrator is only needed so phones / other counters on the shop Wi-Fi can connect).
  3. A "Spoaxio Software" icon appears on the desktop. The first time, it asks for the shop name and owner password.

WHERE THINGS ARE
  Program : C:\\KPR Pitstop\\program   (replaced on every update)
  Data    : C:\\KPR Pitstop\\data      (database kpr.db, backups, uploads - never touched by updates)

UPDATING
  Run the new version's "Install Spoaxio Software.cmd". Data is kept and upgraded automatically.

FORGOT USERNAME OR PASSWORD
  Staff: the owner sets a new one in Staff > Edit.
  Owner: on this PC open Start menu > Spoaxio Software > "Reset password".
         It lists all usernames and sets a new password.

PRINTERS
  Receipt printer (80 mm or 58 mm thermal) and label printer: install their Windows drivers.
  Settings > Printing: choose the receipt paper, and switch on "Silent printing" to print
  receipts without the print window (they go to the Windows DEFAULT printer).

BACKUPS
  Automatic daily backup in C:\\KPR Pitstop\\data\\backups (last 30 kept).
  Settings > Backups to download a copy to a pen drive or restore.

UNINSTALL
  powershell -ExecutionPolicy Bypass -File uninstall.ps1   (data folder is kept)
`),
);

console.log("6/6 Zip");
const zip = path.join(root, "dist", `${name}.zip`);
run(`powershell -NoProfile -Command "Compress-Archive -Path '${out}\\*' -DestinationPath '${zip}' -Force"`);
console.log(`\nDone:\n  ${out}\n  ${zip}`);
