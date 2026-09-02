import type { Metadata } from "next";
import { Clock, Mail, Shield } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPageFrame } from "@/components/legal/legal-page-frame";
import { SUPPORT_EMAIL } from "@/lib/site";

const EMAIL_CLASS = "font-semibold text-violet-300 hover:underline";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.deletion" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function DataDeletionPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal.deletion" });
  const removedItems = t.raw("removedItems") as string[];
  const subject =
    locale === "en"
      ? "Data deletion request — Aura"
      : "Demande de suppression de données — Aura";

  const emailTag = () => (
    <a
      href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`}
      className={EMAIL_CLASS}
    >
      {SUPPORT_EMAIL}
    </a>
  );

  return (
    <LegalPageFrame locale={locale}>
      <header className="space-y-2 border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
        <p className="text-sm text-slate-400">{t("subtitle")}</p>
      </header>

      <section className="space-y-4">
        <p className="leading-relaxed">{t("intro")}</p>
      </section>

      <section className="space-y-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
          <Mail className="h-5 w-5 text-violet-400" />
          {t("emailTitle")}
        </h2>
        <ol className="ml-4 list-decimal space-y-3 text-slate-300">
          <li>
            <p>{t.rich("emailStep1", { email: emailTag })}</p>
          </li>
          <li>
            <p>
              <strong>{t("emailStep2Label")}</strong> {t("emailStep2")}
            </p>
          </li>
          <li>
            <p>
              <strong>{t("emailStep3Label")}</strong> {t("emailStep3")}
            </p>
          </li>
        </ol>
        <p className="text-sm text-slate-400">{t("emailTip")}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <Clock className="h-5 w-5 text-violet-400" />
          <h3 className="font-semibold text-white">{t("delayTitle")}</h3>
          <p className="text-sm text-slate-400">{t("delayBody")}</p>
        </div>
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <Shield className="h-5 w-5 text-violet-400" />
          <h3 className="font-semibold text-white">{t("confirmTitle")}</h3>
          <p className="text-sm text-slate-400">{t("confirmBody")}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("removedTitle")}</h2>
        <ul className="list-inside list-disc space-y-1 text-slate-300">
          {removedItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("keptTitle")}</h2>
        <ul className="list-inside list-disc space-y-1 text-slate-300">
          <li>
            <strong>{t("keptBilling")}</strong>
          </li>
          <li>
            <strong>{t("keptLogs")}</strong>
          </li>
        </ul>
        <p className="text-sm text-slate-400">{t("keptNote")}</p>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-xl font-semibold text-white">{t("thirdTitle")}</h2>
        <p className="leading-relaxed text-slate-300">{t("thirdBody")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">{t("claimTitle")}</h2>
        <p className="leading-relaxed">
          {t.rich("claimBody", {
            cnil: (chunks) => (
              <a
                href="https://www.cnil.fr/fr/plaintes"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </section>
    </LegalPageFrame>
  );
}
