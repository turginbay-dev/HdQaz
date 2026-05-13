const DEFAULT_SITE_URL = "https://hdqaz.online";

function normalizeSiteUrl(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const valueWithProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(valueWithProtocol).origin;
  } catch {
    return null;
  }
}

function isVercelDeploymentUrl(siteUrl: string) {
  try {
    return new URL(siteUrl).hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function getConfiguredSiteUrl() {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL);
}

export function getCanonicalSiteUrl() {
  const configuredCanonicalUrl = normalizeSiteUrl(
    process.env.NEXT_PUBLIC_CANONICAL_SITE_URL ?? process.env.CANONICAL_SITE_URL
  );

  if (configuredCanonicalUrl) {
    return configuredCanonicalUrl;
  }

  const configuredSiteUrl = getConfiguredSiteUrl();

  if (configuredSiteUrl && !isVercelDeploymentUrl(configuredSiteUrl)) {
    return configuredSiteUrl;
  }

  return DEFAULT_SITE_URL;
}

export function getSiteUrl() {
  const configuredSiteUrl = getConfiguredSiteUrl();

  if (configuredSiteUrl) {
    return configuredSiteUrl;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  const vercelProductionUrl = normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);

  if (vercelProductionUrl && !isVercelDeploymentUrl(vercelProductionUrl)) {
    return vercelProductionUrl;
  }

  return getCanonicalSiteUrl();
}
