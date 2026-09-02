import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function LegalPageFrame({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 text-slate-200">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/home"
          locale={locale}
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backHome")}
        </Link>
        {children}
      </div>
    </div>
  );
}
