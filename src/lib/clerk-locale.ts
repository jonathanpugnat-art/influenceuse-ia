import { enUS, frFR } from "@clerk/localizations";
import { routing } from "@/i18n";

type AppLocale = (typeof routing.locales)[number];

function isAppLocale(locale: string): locale is AppLocale {
  return (routing.locales as readonly string[]).includes(locale);
}

export function clerkLocalization(locale: string) {
  const resolved: AppLocale = isAppLocale(locale) ? locale : routing.defaultLocale;
  switch (resolved) {
    case "fr":
      return frFR;
    case "en":
      return enUS;
    default: {
      const _exhaustive: never = resolved;
      void _exhaustive;
      return frFR;
    }
  }
}

export function clerkAuthPaths(locale: string) {
  const resolved = isAppLocale(locale) ? locale : routing.defaultLocale;
  return {
    signInUrl: `/${resolved}/sign-in`,
    signUpUrl: `/${resolved}/sign-up`,
    afterSignOutUrl: `/${resolved}/home`,
    fallbackRedirectUrl: `/${resolved}/influencers`,
  };
}
