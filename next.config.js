/** @type {import('next').NextConfig} */
// Client-side Maps code only sees NEXT_PUBLIC_* unless we map a server-only name here.
// Use either NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY in .env.local, then restart `next dev`.
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

