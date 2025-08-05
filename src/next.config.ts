
import 'dotenv/config';
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  webpack: (config, { isServer }) => {
    // This is to prevent the "Critical dependency: the request of a dependency is an expression" warning
    // It's a common workaround for using firebase-admin in Next.js
    if (!isServer) {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            "firebase-admin": false,
        }
    }
    
    return config;
  }
};

export default nextConfig;
