/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force dynamic rendering for all pages
  output: 'standalone',
  
  // Disable static optimization completely
  trailingSlash: false,
  
  // Disable static generation and force dynamic rendering
  experimental: {
    forceSwcTransforms: true,
  },
  
  // Configure for production deployment
  env: {
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  },
  
  // Disable static optimization for all pages
  async headers() {
    return []
  },
  
  // Force dynamic rendering
  async redirects() {
    return []
  },
}

module.exports = nextConfig
