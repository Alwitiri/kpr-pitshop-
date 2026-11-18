// KPR Pitstop desktop launcher (runs with the bundled node.exe, no install needed).
//   node launcher.js                -> start the app (if needed) and open the window
//   node launcher.js --server-only  -> start the app in the background only (Windows start-up)
//   node launcher.js --stop         -> stop the background app (before updating)
//   node launcher.js --foreground   -> run in the console and show the log (troubleshooting)
"use strict";
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");

const PROGRAM = __dirname;
const APP = path.join(PROGRAM, "app");
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

main().catch((e) => {
  log(`launcher error: ${e && e.stack}`);
  message(`KPR Pitstop error: ${e && e.message}`);
});
