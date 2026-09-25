export function runtimeConfig() {
  return {
    sessionSecret: process.env.SESSION_SECRET,
    publicOrigin: process.env.PUBLIC_ORIGIN,
    setupToken: process.env.TASK_XP_SETUP_TOKEN,
    clientIp: (request: Request) => process.env.TASK_XP_TRUST_PROXY === 'true' ? request.headers.get('x-real-ip') ?? 'unknown' : 'local',
    production: process.env.NODE_ENV === 'production',
  };
}
