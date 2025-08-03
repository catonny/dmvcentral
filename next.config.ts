
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
    // allowedDevOrigins is not an experimental feature in this version.
  },
  allowedDevOrigins: ["6000-firebase-studio-1754096206755.cluster-ikslh4rdsnbqsvu5nw3v4dqjj2.cloudworkstations.dev"],
};

export default nextConfig;
