#!/usr/bin/env node
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PID_FILE = path.join(PROJECT_ROOT, '.server-pids.json');

const SERVER_CONFIG = [
  {
    name: 'error-reporter',
    command: ['node', path.join('dev', 'error-reporter.mjs')],
  },
  {
    name: 'static-server',
    command: ['node', path.join('dev', 'static-server.mjs')],
  },
];

async function main() {
  await stopExistingServers();
  const records = await startServers();
  await fs.writeFile(PID_FILE, JSON.stringify(records, null, 2));
  console.log('Servers restarted successfully.');
}

async function stopExistingServers() {
  let data;

  try {
    data = await fs.readFile(PID_FILE, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  let records;

  try {
    records = JSON.parse(data);
  } catch (error) {
    console.warn('Unable to parse PID file, skipping shutdown step.');
    return;
  }

  for (const { name, pid } of Array.isArray(records) ? records : []) {
    if (typeof pid !== 'number') {
      continue;
    }

    if (!isProcessActive(pid)) {
      continue;
    }

    console.log(`Stopping ${name} (pid ${pid})`);

    try {
      process.kill(pid, 'SIGTERM');
    } catch (error) {
      if (error.code === 'ESRCH') {
        continue;
      }
      console.warn(`Failed to terminate ${name} (pid ${pid}):`, error.message);
      continue;
    }

    try {
      await waitForExit(pid, 5000);
    } catch (error) {
      console.warn(`Graceful shutdown timed out for ${name} (pid ${pid}), forcing exit.`);
      try {
        process.kill(pid, 'SIGKILL');
      } catch (killError) {
        if (killError.code !== 'ESRCH') {
          console.warn(`Failed to force kill ${name} (pid ${pid}):`, killError.message);
        }
      }
    }
  }

  try {
    await fs.unlink(PID_FILE);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function startServers() {
  const results = [];

  for (const { name, command } of SERVER_CONFIG) {
    console.log(`Starting ${name}: ${command.join(' ')}`);
    const [cmd, ...args] = command;
    const child = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      detached: true,
      env: process.env,
    });

    child.on('error', (error) => {
      console.error(`${name} failed to start:`, error);
      process.exitCode = 1;
    });

    child.unref();

    results.push({
      name,
      pid: child.pid,
      command,
      startedAt: new Date().toISOString(),
    });
  }

  return results;
}

function isProcessActive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

function waitForExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (!isProcessActive(pid)) {
        clearInterval(timer);
        resolve();
        return;
      }

      if (Date.now() >= deadline) {
        clearInterval(timer);
        reject(new Error(`Process ${pid} did not exit before timeout`));
      }
    }, 200);
  });
}

main().catch((error) => {
  console.error('restart-servers failed:', error);
  process.exitCode = 1;
});
