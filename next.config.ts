import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  serverExternalPackages: ['argon2', 'better-sqlite3'],
  outputFileTracingExcludes: {
    '/*': ['./scripts/reset-local-password.mjs', './tests/**/*', './examples/**/*', './vendor/**/*', './build/**/*'],
  },
};

export default nextConfig;
