/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
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
