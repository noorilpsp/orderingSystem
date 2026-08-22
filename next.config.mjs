/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    inlineCss: true,
  },
  reactCompiler: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
    qualities: [65, 75],
  },
  async rewrites() {
    return [
      {
        source: "/insights/vitals.js",
        destination:
          "https://cdn.vercel-insights.com/v1/speed-insights/script.js",
      },
	      {
        source: "/insights/events.js",
        destination: "https://cdn.vercel-insights.com/v1/script.js",
      },
      {
        source: "/hfi/events/:slug*",
        destination:
          "https://vitals.vercel-insights.com/v1/:slug*?dsn=KD0ni5HQVdxsHAF2tqBECObqH",
      },
      {
        source: "/hfi/vitals",
        destination:
          "https://vitals.vercel-insights.com/v2/vitals?dsn=fsGnK5U2NRPzYx0Gch0g5w5PxT1",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/menu/:slug",
        destination: "/:slug",
        permanent: true,
      },
      {
        source: "/menu/:slug/:path*",
        destination: "/:slug/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw-orders-push.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/orders",
          },
        ],
      },
      {
        source: "/sw-guest-orders-push.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
