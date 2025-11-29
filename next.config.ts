import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external images from ESPN and Supabase
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
