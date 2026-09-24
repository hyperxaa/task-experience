import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('../.next/standalone/server.js', import.meta.url));
const child = spawn(process.execPath, [server], {
  stdio: 'inherit',
  env: {
    ...process.env,
    HOSTNAME: process.env.HOST || '127.0.0.1',
    PORT: process.env.PORT || '5191',
  },
});
child.on('exit', (code, signal) => {
  process.exit(code ?? (signal === 'SIGTERM' ? 143 : 130));
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
