import { env } from 'cloudflare:workers';

type SiteEnv = { SESSION_SECRET?: string; PUBLIC_ORIGIN?: string; TASK_XP_SETUP_TOKEN?: string };

export function runtimeConfig() {
  const values = env as SiteEnv;
  return {
    sessionSecret: values.SESSION_SECRET,
    publicOrigin: values.PUBLIC_ORIGIN,
    setupToken: values.TASK_XP_SETUP_TOKEN,
    clientIp: (request: Request) => request.headers.get('cf-connecting-ip') ?? 'unknown',
    production: true,
  };
}
