import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n";
import type { Metadata } from "next";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const titles: Record<string, string> = { fr: "Influenceuse IA", en: "Influenceuse IA" };
  const descriptions: Record<string, string> = {
    fr: "Plateforme de création et gestion d'influenceuses virtuelles par IA",
    en: "Platform for creating and managing AI virtual influencers",
  };
  return {
    title: { default: titles[locale] ?? titles.fr, template: `%s | ${titles[locale] ?? titles.fr}` },
    description: descriptions[locale] ?? descriptions.fr,
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      {children}
    </NextIntlClientProvider>
  );
}
