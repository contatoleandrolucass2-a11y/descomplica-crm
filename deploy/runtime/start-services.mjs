import { spawn } from "node:child_process";
const children = new Set();
let stopping = false;
let restartTimer;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  clearTimeout(restartTimer);
  for (const child of children) child.kill(signal);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(signal));
function start(path, worker = false) {
  if (stopping) return;
  const child = spawn(process.execPath, [path], { stdio: "inherit", env: process.env });
  children.add(child);
  let settled = false;
  function ended(code) {
    if (settled) return;
    settled = true;
    children.delete(child);
    if (stopping) return;
    if (worker) {
      console.error("LEAD+ worker stopped; retrying without interrupting the CRM.");
      restartTimer = setTimeout(() => start(path, true), 5000);
    } else {
      process.exitCode = code || 1;
      stop();
    }
  }
  child.on("error", () => ended(1));
  child.on("exit", (code) => ended(code));
}
start("/app/server.js");
if (process.env.LEAD_DB_URL) start("/app/deploy/runtime/lead-plus-worker.mjs", true);
