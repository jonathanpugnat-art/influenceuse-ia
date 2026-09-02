import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPageFrame } from "@/components/legal/legal-page-frame";
import { SUPPORT_EMAIL } from "@/lib/site";

const EMAIL_CLASS = "text-violet-400 hover:underline";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal.privacy" });
  const legal = await getTranslations({ locale, namespace: "legal" });
  const dataItems = t.raw("s2Items") as string[];
  const purposeItems = t.raw("s3Items") as string[];
  const processorItems = t.raw("s4Items") as string[];

  const emailTag = () => (
    <a href={`mailto:${SUPPORT_EMAIL}`} className={EMAIL_CLASS}>
      {SUPPORT_EMAIL}
    </a>
  );

  return (
    <LegalPageFrame locale={locale}>
      <header className="space-y-2 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
        <p className="text-sm text-slate-400">
          {legal("updated", { date: locale === "en" ? "May 18, 2026" : "18 mai 2026" })}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("s1Title")}</h2>
        <p className="leading-relaxed">{t.rich("s1Body", { email: emailTag })}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("s2Title")}</h2>
        <p className="leading-relaxed">{t("s2Intro")}</p>
        <ul className="list-inside list-disc space-y-1 text-slate-300">
          {dataItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("s3Title")}</h2>
        <p className="leading-relaxed">{t("s3Intro")}</p>
        <ul className="list-inside list-disc space-y-1 text-slate-300">
          {purposeItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="leading-relaxed">{t("s3NoSale")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("s4Title")}</h2>
        <p className="leading-relaxed">{t("s4Intro")}</p>
        <ul className="list-inside list-disc space-y-1 text-slate-300">
          {processorItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("s5Title")}</h2>
        <p className="leading-relaxed">{t("s5Body")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("s6Title")}</h2>
        <p className="leading-relaxed">
          {t.rich("s6Body", {
            email: emailTag,
            deletion: (chunks) => (
              <Link href="/data-deletion" locale={locale} className={EMAIL_CLASS}>
                {chunks}
              </Link>
            ),
          })}
        </p>
        <p className="leading-relaxed">{t("s6Cnil")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("s7Title")}</h2>
        <p className="leading-relaxed">{t("s7Body")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("s8Title")}</h2>
        <p className="leading-relaxed">{t.rich("s8Body", { email: emailTag })}</p>
      </section>
    </LegalPageFrame>
  );
}
