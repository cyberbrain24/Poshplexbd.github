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
      /\/media\//,
      /localhost/,
      /127\.0\.0\.1/,
    ],
    runtimeCaching: [
      {
        // Never cache media files - always fetch fresh from the server
        urlPattern: /\/media\/.*/,
        handler: 'NetworkOnly',
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
