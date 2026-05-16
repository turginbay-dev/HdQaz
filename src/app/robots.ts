import type { MetadataRoute } from "next";
import { getCanonicalSiteUrl, getCanonicalUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getCanonicalSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/auth", "/login", "/profile"]
      }
    ],
    sitemap: getCanonicalUrl("/sitemap.xml"),
    host: siteUrl
  };
}
