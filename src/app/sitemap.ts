import type { MetadataRoute } from "next";
import { locales } from "@/i18n";
import { SITE_URL } from "@/lib/site";

const PUBLIC_PATHS = [
  "/home",
  "/pricing",
  "/changelog",
  "/privacy",
  "/terms",
  "/mentions",
  "/data-deletion",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = SITE_URL.replace(/\/$/, "");

  return locales.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${origin}/${locale}${path}`,
      changeFrequency: path === "/home" ? "weekly" : "monthly",
      priority: path === "/home" ? 1 : 0.6,
    }))
  );
}
