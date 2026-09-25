import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export function sites(): Plugin {
  let root = process.cwd();
  return {
    name: 'task-xp-sites',
    configResolved(config) { root = config.root; },
    async closeBundle() {
      const target = resolve(root, 'dist/.openai');
      await rm(target, { recursive: true, force: true });
      await mkdir(target, { recursive: true });
      await cp(resolve(root, '.openai/hosting.json'), resolve(target, 'hosting.json'));
      await cp(resolve(root, 'drizzle'), resolve(target, 'drizzle'), { recursive: true });
    },
  };
}
