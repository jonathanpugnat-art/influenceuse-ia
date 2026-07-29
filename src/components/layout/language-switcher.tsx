"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const locales = [
  { value: "fr" as const, label: "Français" },
  { value: "en" as const, label: "English" },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("layout");
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const handleSelect = (newLocale: "fr" | "en") => {
    if (newLocale === locale) return;
    router.replace(pathname, { locale: newLocale });
  };

  const triggerClasses =
    "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground";

  if (!mounted) {
    return (
      <button
        type="button"
        className={triggerClasses}
        aria-label={t("changeLanguage")}
      >
        <Globe className="h-4 w-4" />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={triggerClasses}
          aria-label={t("changeLanguage")}
        >
          <Globe className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc.value}
            onClick={() => handleSelect(loc.value)}
            className={`cursor-pointer ${
              locale === loc.value ? "font-medium" : ""
            }`}
          >
            {loc.label}
            {locale === loc.value && (
              <Check className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
