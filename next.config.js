/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // double-metaphone ships as pure ESM; webpack needs to transpile it
  transpilePackages: ['double-metaphone'],
  webpack: (config, { dev }) => {
    // Windows: filesystem webpack cache can desync from .next (stale chunks, missing manifests).
    // `cache: false` has been seen to leave `.next/server` incomplete (middleware-manifest missing).
    // In-memory dev cache avoids disk drift without skipping webpack output.
    if (dev) {
      config.cache = { type: 'memory' }
    }
    return config
  },
}

module.exports = nextConfig
