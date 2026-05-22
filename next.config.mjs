import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      // Replace better-sqlite3 with a browser stub so the import chain
      // (tools → soql → sqlite → better-sqlite3) doesn't crash the client
      // bundle. The stub constructor is never called because getDb() is
      // server-side only.
      config.resolve.alias = {
        ...config.resolve.alias,
        'better-sqlite3': path.resolve(__dirname, 'lib/stubs/better-sqlite3.js'),
      };

      // Strip node: prefix so built-in fallbacks apply
      config.plugins.push({
        apply(compiler) {
          compiler.hooks.normalModuleFactory.tap('StripNodePrefix', (factory) => {
            factory.hooks.beforeResolve.tap('StripNodePrefix', (data) => {
              if (data.request.startsWith('node:')) {
                data.request = data.request.slice(5);
              }
            });
          });
        },
      });
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
