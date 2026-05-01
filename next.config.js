/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    // Disk webpack cache under node_modules/.cache can desync from .next on Windows
    // (MODULE_NOT_FOUND for ./NNN.js, missing fallback-build-manifest). Memory cache
    // avoids stale chunk references after partial deletes or multiple dev servers.
    if (dev) {
      config.cache = { type: 'memory' }
    }
    return config
  },
}

module.exports = nextConfig
