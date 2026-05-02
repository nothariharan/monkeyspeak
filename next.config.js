/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    // Windows: webpack cache can drift from .next manifests → 404 on layout.css / page.js.
    // Default `npm run dev` uses webpack with cache off. Use `npm run dev:turbo` if you prefer Turbopack.
    if (dev) {
      config.cache = false
    }
    return config
  },
}

module.exports = nextConfig
