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
        hostname: '*.supabase.co',
      },
    ],
  },
  
  // Security headers - allow Supabase connections
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.the-odds-api.com https://site.api.espn.com https://a.espncdn.com",
              "frame-src 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
