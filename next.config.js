/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Exclude native folders from Next.js output file tracing on Vercel
    outputFileTracingExcludes: {
      '*': [
        'android/**',
        '**/android/**',
        'android/**/build/**',
        'android/**/gradle/**',
        'ios/**',
        '**/ios/**',
        'ios/**/Pods/**',
        '**/Pods/**',
        '**/*.xcworkspace/**',
        '**/*.xcodeproj/**',
        '**/*.xcframework/**',
        '**/*.xcuserdatad/**',
        '**/*.pbxproj',
      ],
    },
  },
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
