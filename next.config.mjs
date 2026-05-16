/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  webpack(config, { isServer }) {
    if (!isServer) {
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
