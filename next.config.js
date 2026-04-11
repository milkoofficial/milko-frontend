/** @type {import('next').NextConfig} */
const { loadEnvConfig } = require('@next/env');

// Load .env / .env.local before reading keys. Without this, this file can run before
// those files are applied and the Maps key stays empty in the client bundle.
loadEnvConfig(__dirname);

// Client-side Maps reads NEXT_PUBLIC_*; we also accept GOOGLE_MAPS_API_KEY here and map it through.
// Use either name in .env.local next to package.json, then restart the dev server (Ctrl+C, then npm run dev).
const googleMapsApiKey = String(
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
)
  .trim()
  .replace(/^['"]|['"]$/g, '');

const nextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: googleMapsApiKey,
  },

  reactStrictMode: true,

  // Avoid stale admin UI after deploy (browser / CDN keeping old HTML or JS chunks)
  async headers() {
    const adminNoStore = [{ key: 'Cache-Control', value: 'private, no-store, must-revalidate' }];
    return [
      { source: '/admin', headers: adminNoStore },
      { source: '/admin/:path*', headers: adminNoStore },
    ];
  },

  // Image optimization for Cloudinary
  images: {
    domains: ['res.cloudinary.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  // Suppress build warnings
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig

