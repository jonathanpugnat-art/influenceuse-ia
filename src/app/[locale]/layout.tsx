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
  const titles: Record<string, string> = {
    fr: "Aura Influences — Le même visage. Sur chaque scène.",
    en: "Aura Influences — The same face. On every scene.",
  };
  const descriptions: Record<string, string> = {
    fr: "Aura Influences : studio SaaS pour créer des influenceuses IA à visage verrouillé (PuLID / InstantID), générer photos et reels au crédit, et publier automatiquement sur Instagram et TikTok. Free 0 €, Creator 29 €, Pro 79 €, Agency 199 €.",
    en: "Aura Influences: a SaaS studio to build AI influencers with a locked face (PuLID / InstantID), generate photos and reels by credit, and auto-publish to Instagram and TikTok. Free €0, Creator €29, Pro €79, Agency €199.",
  };
  return {
    title: { default: titles[locale] ?? titles.fr, template: `%s | Aura Influences` },
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
