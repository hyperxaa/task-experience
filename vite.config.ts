import { resolve } from 'node:path';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import { sites } from './build/sites-vite-plugin';

export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= 'false';
  process.env.WRANGLER_SEND_METRICS ??= 'false';
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.WRANGLER_REGISTRY_PATH ??= '.wrangler/dev-registry';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  return {
    resolve: {
      alias: [
        { find: '../db/platform', replacement: resolve('db/sites.ts') },
        { find: './runtime-config', replacement: resolve('lib/runtime-config.sites.ts') },
      ],
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        inspectorPort: false,
        config: {
          main: 'vinext/server/fetch-handler',
          compatibility_date: '2026-05-22',
          compatibility_flags: ['nodejs_compat'],
          d1_databases: [{ binding: 'DB', database_name: 'task-xp', database_id: '00000000-0000-4000-8000-000000000000' }],
        },
      }),
    ],
  };
});
