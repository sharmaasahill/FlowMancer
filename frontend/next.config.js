/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Import only the animation/icon pieces each page uses instead of whole libraries
    optimizePackageImports: ['framer-motion', 'lucide-react', 'recharts'],
  },
};

module.exports = nextConfig;
