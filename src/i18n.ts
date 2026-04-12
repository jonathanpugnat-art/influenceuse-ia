import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  localePrefix: "always",
  localeDetection: true,
});

export const locales = routing.locales;
export const defaultLocale = routing.defaultLocale;
