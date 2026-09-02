"use client";

import { useEffect } from "react";

/** Root layout cannot read `[locale]`; keep `<html lang>` in sync with the URL. */
export function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
