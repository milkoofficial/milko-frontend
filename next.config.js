/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
}

module.exports = nextConfig

