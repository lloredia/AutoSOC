import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['--watch', 'server/index.js'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];

function shutdown(code = 0) {
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (signal) return;
    shutdown(code ?? 0);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
