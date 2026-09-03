/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    // Exclude media files, API calls, and any localhost references from SW caching
    // This prevents broken localhost:8000 URLs from being permanently cached
    exclude: [
      /localhost/,
      /127\.0\.0\.1/,
    ],
    runtimeCaching: [
      {
        // Cache media files locally for 30 days to drastically improve performance on repeat visits
        urlPattern: /\/media\/.*/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'media-images-cache',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
          },
        },
      },
      {
        // Never cache API responses in SW - let Next.js handle caching
        urlPattern: /\/api\/.*/,
        handler: 'NetworkOnly',
      },
    ],
  },
});

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'media.poshplexbd.com',
      },
      {
        protocol: 'https',
        hostname: 'api.poshplexbd.com',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'poshplexbd.com',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: '*.ngrok-free.app',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: '*.ngrok.io',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: 'cdn.poshplexbd.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

module.exports = withPWA(nextConfig);
