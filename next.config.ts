import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.hdqaz.online"
          }
        ],
        destination: "https://hdqaz.online/:path*",
        permanent: true
      }
    ];
  },
  images: {
    remotePatterns: [
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL ? [{ protocol: "https" as const, hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, pathname: "/storage/v1/object/public/content-media/**" }] : []),
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**"
      },
      {
        protocol: "https",
        hostname: "media.themoviedb.org",
        pathname: "/t/p/**"
      },
      {
        protocol: "https",
        hostname: "cdn.hdqaz.online",
        pathname: "/**"
      }
    ],
    formats: ["image/avif", "image/webp"]
  }
};

export default nextConfig;
