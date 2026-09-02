import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPageFrame } from "@/components/legal/legal-page-frame";
import { SUPPORT_EMAIL } from "@/lib/site";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.mentions" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function MentionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal.mentions" });
  const legal = await getTranslations({ locale, namespace: "legal" });

  return (
    <LegalPageFrame locale={locale}>
      <header className="space-y-2 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
        <p className="text-sm text-slate-400">
          {legal("updated", { date: locale === "en" ? "August 21, 2026" : "21 août 2026" })}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("editorTitle")}</h2>
        <p className="leading-relaxed text-slate-300">{t("editorBody")}</p>
        <p className="leading-relaxed text-slate-300">
          {t("contact")}{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-violet-400 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("hostTitle")}</h2>
        <p className="leading-relaxed text-slate-300">{t("hostBody")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("ipTitle")}</h2>
        <p className="leading-relaxed text-slate-300">{t("ipBody")}</p>
      </section>
    </LegalPageFrame>
  );
}
