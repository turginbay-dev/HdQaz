import type { MetadataRoute } from "next";
import { listContents } from "@/features/content/repository";
import { getCanonicalSiteUrl } from "@/lib/site-url";
import type { Content } from "@/types/content";

export const dynamic = "force-dynamic";

type SitemapEntry = MetadataRoute.Sitemap[number];

const staticRoutes = [
  {
    path: "/",
    changeFrequency: "daily",
    priority: 1
  },
  {
    path: "/catalog",
    changeFrequency: "daily",
    priority: 0.9
  },
  {
    path: "/requests",
    changeFrequency: "weekly",
    priority: 0.55
  },
  {
    path: "/premium",
    changeFrequency: "monthly",
    priority: 0.4
  }
] satisfies Array<{
  path: string;
  changeFrequency: NonNullable<SitemapEntry["changeFrequency"]>;
  priority: number;
}>;

function buildUrl(path: string) {
  return new URL(path, getCanonicalSiteUrl()).toString();
}

function buildContentUrl(slug: string) {
  return buildUrl(`/${encodeURIComponent(slug)}`);
}

function toLastModified(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getLatestContentModified(contents: Content[]) {
  return contents.reduce<Date | undefined>((latest, content) => {
    const current = toLastModified(content.updatedAt ?? content.createdAt);

    if (!current) {
      return latest;
    }

    return !latest || current > latest ? current : latest;
  }, undefined);
}

function normalizeImageUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = value.startsWith("/") ? new URL(value, getCanonicalSiteUrl()) : new URL(value);

    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getContentImages(content: Content) {
  return Array.from(
    new Set([normalizeImageUrl(content.posterUrl), normalizeImageUrl(content.bannerUrl)].filter((url): url is string => Boolean(url)))
  );
}

function toStaticEntries(latestContentModified?: Date): MetadataRoute.Sitemap {
  return staticRoutes.map((route) => ({
    url: buildUrl(route.path),
    lastModified: route.path === "/premium" ? undefined : latestContentModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}

function toContentEntry(content: Content): SitemapEntry {
  const images = getContentImages(content);

  return {
    url: buildContentUrl(content.slug),
    lastModified: toLastModified(content.updatedAt ?? content.createdAt),
    changeFrequency: content.status === "ongoing" ? "daily" : "weekly",
    priority: content.status === "ongoing" ? 0.85 : 0.8,
    ...(images.length > 0 ? { images } : {})
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const contents = await listContents();
    const latestContentModified = getLatestContentModified(contents);

    return [...toStaticEntries(latestContentModified), ...contents.map(toContentEntry)];
  } catch (error) {
    console.error("Failed to build dynamic sitemap entries.", error);

    return toStaticEntries();
  }
}
