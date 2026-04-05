/** @type {import('next').NextConfig} */
const nextConfig = {
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
