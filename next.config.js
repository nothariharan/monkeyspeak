/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    // Windows: webpack filesystem/memory caches can drift from .next manifests → 404 on
    // webpack.js / layout.css / page.js. Turbopack (`npm run dev`) avoids this path.
    // When using `npm run dev:webpack`, disable cache so chunk graphs stay consistent.
    if (dev) {
      config.cache = false
    }
    return config
  },
}

module.exports = nextConfig
