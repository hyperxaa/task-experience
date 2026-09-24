import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const build = spawnSync(process.execPath, [cli, 'build'], { stdio: 'inherit' });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const standalone = resolve('.next/standalone');
if (existsSync('.next/static')) {
  mkdirSync(resolve(standalone, '.next'), { recursive: true });
  cpSync('.next/static', resolve(standalone, '.next/static'), { recursive: true });
}
if (existsSync('public')) cpSync('public', resolve(standalone, 'public'), { recursive: true });
