// KPR Pitstop desktop launcher (runs with the bundled node.exe, no install needed).
//   node launcher.js                -> start the app (if needed) and open the window
//   node launcher.js --server-only  -> start the app in the background only (Windows start-up)
//   node launcher.js --stop         -> stop the background app (before updating)
//   node launcher.js --foreground   -> run in the console and show the log (troubleshooting)
//   node launcher.js --reset-password -> forgotten password: set a new one (shop PC only)
"use strict";
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");

const PROGRAM = __dirname;
const APP = process.env.KPR_APP_DIR || path.join(PROGRAM, "app");
const NODE = path.join(PROGRAM, "node", "node.exe");
const DATA = process.env.KPR_DATA_DIR || path.resolve(PROGRAM, "..", "data");
const CONFIG = path.join(DATA, "config.json");
const PID = path.join(DATA, "server.pid");
const LOGS = path.join(DATA, "logs");
const args = process.argv.slice(2);

fs.mkdirSync(LOGS, { recursive: true });

function log(msg) {
  fs.appendFileSync(path.join(LOGS, "launcher.log"), `[${new Date().toISOString()}] ${msg}\n`);
}

function config() {
  let c = {};
  try {
    c = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  } catch {}
  let changed = false;
  if (!c.authSecret) {
    c.authSecret = crypto.randomBytes(32).toString("hex");
    changed = true;
  }
  if (!c.port) {
    c.port = 3780;
    changed = true;
  }
  if (changed) fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2));
  return c;
}

function healthy(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/api/health", timeout: 1500 }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve(res.statusCode === 200 && body.includes("kpr-pitstop")));
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startServer(c, foreground = false) {
  const out = foreground ? "inherit" : fs.openSync(path.join(LOGS, "server.log"), "a");
  const dbFile = path.join(DATA, "kpr.db").replace(/\\/g, "/");
  const child = spawn(NODE, ["server.js"], {
    cwd: APP,
    detached: !foreground,
    windowsHide: true,
    stdio: ["ignore", out, out],
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(c.port),
      // "::" listens on IPv6 + IPv4: "localhost" always works, and other shop devices can connect
      HOSTNAME: "::",
      DATABASE_URL: `file:${dbFile}`,
      AUTH_SECRET: c.authSecret,
      KPR_DATA_DIR: DATA,
      KPR_MIGRATIONS_DIR: path.join(APP, "prisma", "migrations-sql"),
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  fs.writeFileSync(PID, String(child.pid));
  log(`server started pid=${child.pid} port=${c.port}${foreground ? " (foreground)" : ""}`);
  if (foreground) child.on("exit", (code) => process.exit(code ?? 0));
  else child.unref();
}

function openWindow(url) {
  // Edge "app" window: no address bar, looks like a normal program. Falls back to the default browser.
  const edge = [
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft\\Edge\\Application\\msedge.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Microsoft\\Edge\\Application\\msedge.exe"),
  ].find((p) => fs.existsSync(p));
  if (edge) {
    spawn(edge, [`--app=${url}`, "--window-size=1366,820", "--start-maximized"], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  }
}

async function waitUp(port, seconds) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await healthy(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function message(text) {
  // Simple Windows message box so the shop staff see what went wrong
  execFile("mshta", [`javascript:alert(${JSON.stringify(text)});close()`], { windowsHide: true }, () => {});
}

async function main() {
  const c = config();

  if (args.includes("--stop")) {
    try {
      const pid = Number(fs.readFileSync(PID, "utf8"));
      if (pid) process.kill(pid);
      fs.rmSync(PID, { force: true });
      log(`server stopped pid=${pid}`);
    } catch {}
    return;
  }

  if (args.includes("--reset-password")) {
    await resetPassword();
    return;
  }

  if (args.includes("--foreground")) {
    // Troubleshooting: run in this console window and show the server output
    startServer(c, true);
    return;
  }

  if (!(await healthy(c.port))) {
    startServer(c);
    const ok = await waitUp(c.port, 90);
    if (!ok) {
      log("server did not start in time");
      message(`KPR Pitstop could not start.\n\nSee the log file:\n${path.join(LOGS, "server.log")}`);
      return;
    }
  }
  if (!args.includes("--server-only")) openWindow(`http://localhost:${c.port}`);
}

// ───────────── Forgotten password recovery (only works on the shop PC itself) ─────────────
function prompter() {
  const readline = require("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  let muted = false;
  rl._writeToOutput = function (s) {
    if (!muted || /\r|\n/.test(s)) rl.output.write(s);
    else rl.output.write("*".repeat(s.length));
  };
  const lines = [];
  const waiters = [];
  rl.on("line", (l) => (waiters.length ? waiters.shift()(l) : lines.push(l)));
  rl.on("close", () => waiters.splice(0).forEach((w) => w(null)));
  const ask = (q, hidden = false) =>
    new Promise((resolve) => {
      process.stdout.write(q);
      muted = hidden && !!process.stdin.isTTY;
      const done = (l) => {
        muted = false;
        if (!process.stdin.isTTY) process.stdout.write("\n");
        resolve(l == null ? null : l.trim());
      };
      lines.length ? done(lines.shift()) : waiters.push(done);
    });
  return { ask, close: () => rl.close() };
}

async function resetPassword() {
  const appRequire = require("node:module").createRequire(path.join(APP, "server.js"));
  process.env.DATABASE_URL = `file:${path.join(DATA, "kpr.db").replace(/\\/g, "/")}`;
  if (!fs.existsSync(path.join(DATA, "kpr.db"))) {
    console.log("\n  No KPR data found on this PC yet. Open KPR Pitstop once to set it up.\n");
    return pause();
  }
  const { PrismaClient } = appRequire("@prisma/client");
  // bcryptjs ships as an ES module in the packaged app
  const bcryptUrl = require("node:url").pathToFileURL(path.join(APP, "node_modules", "bcryptjs", "index.js")).href;
  const bcrypt = (await import(bcryptUrl)).default;
  const db = new PrismaClient();
  const io = prompter();
  try {
    console.log("\n  ===== KPR Pitstop - reset a login password =====\n");
    const users = await db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });
    if (!users.length) {
      console.log("  No logins exist yet. Open KPR Pitstop to create the owner account.");
      return;
    }
    console.log("  Logins on this PC:\n");
    users.forEach((u, i) =>
      console.log(`   ${String(i + 1).padStart(2)}. ${u.username.padEnd(16)} ${u.name.padEnd(22)} ${u.role.toLowerCase()}${u.active ? "" : "  (disabled)"}`),
    );
    const owners = users.filter((u) => u.role === "OWNER");
    const def = owners.length === 1 ? owners[0] : null;
    const pick = await io.ask(`\n  Number or username to reset${def ? ` [${def.username}]` : ""}: `);
    if (pick === null) return;
    const user = !pick && def ? def : users[Number(pick) - 1] || users.find((u) => u.username === (pick || "").toLowerCase());
    if (!user) {
      console.log("\n  Not found. Nothing changed.");
      return;
    }
    let pw = "";
    for (;;) {
      pw = (await io.ask(`  New password for ${user.username} (min 6 characters): `, true)) ?? "";
      if (pw.length < 6) {
        console.log("  Too short, try again.");
        continue;
      }
      const again = (await io.ask("  Type it again: ", true)) ?? "";
      if (again === pw) break;
      console.log("  The two passwords do not match, try again.");
    }
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(pw, 10), active: true } });
    await db.auditLog.create({ data: { userId: user.id, action: "PASSWORD_RESET_ON_SHOP_PC", entity: "User", entityId: String(user.id), details: "Reset with the Start menu tool" } });
    log(`password reset for ${user.username}`);
    console.log(`\n  Done. Log in as "${user.username}" with the new password.\n`);
  } finally {
    io.close();
    await db.$disconnect();
    await pause();
  }
}

function pause() {
  if (!process.stdin.isTTY) return Promise.resolve();
  return new Promise((r) => {
    process.stdout.write("  Press Enter to close...");
    process.stdin.resume();
    process.stdin.once("data", () => r());
  });
}

main().catch((e) => {
  log(`launcher error: ${e && e.stack}`);
  message(`KPR Pitstop error: ${e && e.message}`);
});
