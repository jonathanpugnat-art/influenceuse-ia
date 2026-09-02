import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n";
import type { Metadata } from "next";
import { ClerkLocaleProvider } from "@/components/layout/clerk-locale-provider";
import { HtmlLang } from "@/components/layout/html-lang";

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
    fr: "Aura Influences — Créez vos influenceuses IA",
    en: "Aura Influences — Build your AI influencers",
  };
  const descriptions: Record<string, string> = {
    fr: "Aura Influences : plateforme tout-en-un pour créer, animer et publier des influenceuses virtuelles générées par IA. Photos iPhone-réelles, reels TikTok, planning auto. Bêta gratuite.",
    en: "Aura Influences: the all-in-one platform to create, animate and publish AI-generated virtual influencers. iPhone-real photos, TikTok reels, auto scheduling. Free beta.",
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
    <ClerkLocaleProvider locale={locale}>
      <NextIntlClientProvider messages={messages} locale={locale}>
        <HtmlLang locale={locale} />
        {children}
      </NextIntlClientProvider>
    </ClerkLocaleProvider>
  );
}
