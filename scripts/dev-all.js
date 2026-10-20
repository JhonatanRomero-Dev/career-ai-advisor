import { spawn } from "child_process";
import path from "path";
import readline from "readline";
import process from "process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "backend");

function startCommand(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const prefixStream = (stream) => {
    const rl = readline.createInterface({ input: stream });

    rl.on("line", (line) => {
      process.stdout.write(`[${label}] ${line}\n`);
    });

    return rl;
  };

  prefixStream(child.stdout);
  prefixStream(child.stderr);

  return child;
}

const backend = startCommand("backend", "npm", ["run", "dev"], backendDir);
const frontend = startCommand("frontend", "npm", ["run", "dev"], rootDir);
const children = [backend, frontend];
let shuttingDown = false;

function stopChildren(signal = "SIGINT") {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => stopChildren(signal));
}

for (const child of children) {
  child.once("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code === 0) {
      stopChildren();
      process.exit(0);
      return;
    }

    stopChildren(signal || "SIGTERM");
    process.exit(code ?? 1);
  });
}
