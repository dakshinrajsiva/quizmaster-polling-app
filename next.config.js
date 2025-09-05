/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static optimization for client-side pages
  output: 'standalone',
  
  // Disable static generation for dynamic pages
  trailingSlash: false,
  
  // Configure for production deployment
  env: {
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  },
}

module.exports = nextConfig
