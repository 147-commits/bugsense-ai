import type { MetadataRoute } from 'next';

/**
 * Production deployments allow indexing; everything else (Vercel previews,
 * dev) is disallowed so preview URLs never show up in search results.
 */
export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.VERCEL_ENV === 'production';
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://bugsense.local';

  if (!isProd) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Don't index the authenticated app surface or anything API/cron.
        disallow: ['/api/', '/dashboard', '/bugs', '/analytics', '/settings'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
