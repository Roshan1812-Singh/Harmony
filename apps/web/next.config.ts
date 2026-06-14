import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // `output: 'standalone'` is only needed for container deploys and requires
  // symlink permissions that Windows + OneDrive deny (EPERM). `next start`
  // runs from the regular `.next` build without it.
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'http', hostname: 'localhost', port: '9000' }, // MinIO in dev
      { protocol: 'https', hostname: '**.mzstatic.com' }, // Apple / iTunes artwork
      { protocol: 'https', hostname: '**.saavncdn.com' }, // JioSaavn artwork
      { protocol: 'https', hostname: '**.dzcdn.net' }, // Deezer artwork
      { protocol: 'https', hostname: '**.jamendo.com' }, // Jamendo artwork
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  async headers() {
    // Derive the API origin from NEXT_PUBLIC_API_URL so CSP allows the deployed
    // backend (e.g. https://harmony-api.up.railway.app) as well as local dev.
    const apiOrigin = (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1').origin;
      } catch {
        return 'http://localhost:4001';
      }
    })();

    const imgSrc =
      "https://*.cloudfront.net http://localhost:9000 https://*.mzstatic.com https://*.saavncdn.com https://*.dzcdn.net https://*.jamendo.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com";
    const mediaSrc =
      `https://*.cloudfront.net http://localhost:9000 ${apiOrigin} https://*.itunes.apple.com https://*.mzstatic.com https://*.saavncdn.com https://*.dzcdn.net https://*.jamendo.com`;
    const csp = [
      "default-src 'self'",
      `img-src 'self' data: blob: ${apiOrigin} ${imgSrc}`,
      `media-src 'self' blob: ${mediaSrc}`,
      `connect-src 'self' ${apiOrigin} https://*.cloudfront.net`,
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js needs unsafe-eval in dev; tighten in prod via nonce
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
