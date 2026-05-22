const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async redirects() {
    return [
      { source: '/register', destination: '/signup', permanent: true },
    ];
  },
};

// Wrap with Sentry only when source-map credentials are configured. Without
// SENTRY_AUTH_TOKEN the Sentry webpack plugin warns on every build; gating
// here keeps `npm run build` quiet in environments without telemetry.
module.exports = process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      hideSourceMaps: true,
      widenClientFileUpload: true,
    })
  : nextConfig;
