// Builds the offline Windows package:
//   dist/KPR-Pitstop-<version>/            (folder you can copy on a pen drive)
//   dist/KPR-Pitstop-<version>.zip         (same, zipped)
// Contents: "Install KPR Pitstop.cmd", install.ps1, uninstall.ps1, program/ (app + node.exe + launcher)
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const name = `KPR-Pitstop-${pkg.version}`;
const out = path.join(root, "dist", name);
const program = path.join(out, "program");
const app = path.join(program, "app");
const run = (cmd) => execSync(cmd, { stdio: "inherit" });

rmSync(path.join(root, "dist"), { recursive: true, force: true });

console.log("1/6 Icon");
run("node scripts/make-icon.mjs");

console.log("2/6 Production build");
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
const engine = execSync(`dir /s /b "${app}\\*query_engine*.node"`, { encoding: "utf8", shell: "cmd.exe" }).trim();
if (!engine) throw new Error("Prisma query engine missing from standalone output");
console.log("   prisma engine:", path.relative(app, engine.split(/\r?\n/)[0]));

console.log("4/6 Bundle Node.js runtime", process.version);
mkdirSync(path.join(program, "node"), { recursive: true });
cpSync(process.execPath, path.join(program, "node", "node.exe"));

console.log("5/6 Launcher & installer");
const crlf = (s) => s.replace(/\r?\n/g, "\r\n");
for (const f of ["launcher.js", "kpr.ico"]) cpSync(path.join(root, "packaging", f), path.join(program, f));
writeFileSync(path.join(program, "KPR Pitstop.vbs"), crlf(readFileSync("packaging/KPR Pitstop.vbs", "utf8")));
for (const f of ["install.ps1", "uninstall.ps1", "Install KPR Pitstop.cmd"]) {
  writeFileSync(path.join(out, f), crlf(readFileSync(path.join("packaging", f), "utf8")));
}
writeFileSync(
  path.join(out, "README.txt"),
  crlf(`KPR Pitstop ${pkg.version} - offline business software

INSTALL / UPDATE
  1. Copy this whole folder to the shop PC (pen drive is fine).
  2. Right-click "Install KPR Pitstop.cmd" > Run as administrator
     (administrator is only needed so phones / other counters on the shop Wi-Fi can connect).
  3. A "KPR Pitstop" icon appears on the desktop. The first time, it asks for the shop name and owner password.

WHERE THINGS ARE
  Program : C:\\KPR Pitstop\\program   (replaced on every update)
  Data    : C:\\KPR Pitstop\\data      (database kpr.db, backups, uploads - never touched by updates)

UPDATING
  Run the new version's "Install KPR Pitstop.cmd". Data is kept and upgraded automatically.

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
