import { spawn } from 'node:child_process';

const child = spawn('pnpm', ['exec', 'size-limit'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env,
});

child.stdout.pipe(process.stdout);

let suppressWarnings = false;
child.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  const lines = text.split(/\r?\n/);
  const out = [];

  for (const line of lines) {
    if (line.includes('Duplicate key "pino" in object literal')) {
      suppressWarnings = true;
      continue;
    }
    if (suppressWarnings) {
      if (line.includes('Adding to empty esbuild project')) {
        suppressWarnings = false;
        out.push(line);
      }
      continue;
    }
    out.push(line);
  }

  const cleaned = out.join('\n');
  if (cleaned.trim() !== '') {
    process.stderr.write(cleaned + (text.endsWith('\n') ? '\n' : ''));
  }
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
