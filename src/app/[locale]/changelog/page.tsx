import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Sparkles, Rocket, Wrench, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Changelog — Influenceuse IA",
  description:
    "Toutes les nouveautés, améliorations et fixes d'Influenceuse IA, sprint après sprint.",
};

interface Release {
  version: string;
  sprint: string;
  date: string;
  highlights: string[];
  /** Tailwind classes for the gradient ribbon. */
  accent: string;
}

/**
 * Sprint 10 — Public changelog page.
 * Static, SSR-friendly, no auth required. Hand-curated highlights so the
 * marketing copy stays sharp; full details live in /CHANGELOG.md on git.
 */
export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "changelog" });

  const releases: Release[] = [
    {
      version: "v0.9.0",
      sprint: t("releases.sprint9"),
      date: "2026-05-07",
      accent: "from-violet-500 to-indigo-500",
      highlights: [
        t("v09.api"),
        t("v09.workspaces"),
        t("v09.media"),
        t("v09.referral"),
      ],
    },
    {
      version: "v0.8.0",
      sprint: t("releases.sprint8"),
      date: "2026-05-07",
      accent: "from-cyan-500 to-emerald-500",
      highlights: [
        t("v08.analytics"),
        t("v08.memory"),
        t("v08.recycler"),
        t("v08.ab"),
      ],
    },
    {
      version: "v0.7.0",
      sprint: t("releases.sprint7"),
      date: "2026-05-07",
      accent: "from-fuchsia-500 to-pink-500",
      highlights: [
        t("v07.templates"),
        t("v07.video"),
        t("v07.packs"),
        t("v07.rename"),
      ],
    },
    {
      version: "v0.6.0",
      sprint: t("releases.phase6"),
      date: "2026-04",
      accent: "from-amber-500 to-orange-500",
      highlights: [t("v06.starter"), t("v06.checklist"), t("v06.upgradeModal")],
    },
    {
      version: "v0.5.0",
      sprint: t("releases.phase5"),
      date: "2026-04",
      accent: "from-emerald-500 to-teal-500",
      highlights: [t("v05.webhooks"), t("v05.idempotent"), t("v05.tokenRefresh")],
    },
    {
      version: "v0.4.0",
      sprint: t("releases.phase4"),
      date: "2026-04",
      accent: "from-blue-500 to-cyan-500",
      highlights: [t("v04.batches"), t("v04.cron"), t("v04.panel")],
    },
    {
      version: "v0.3.0",
      sprint: t("releases.phase3"),
      date: "2026-03",
      accent: "from-purple-500 to-violet-500",
      highlights: [t("v03.plans"), t("v03.claude"), t("v03.ideas")],
    },
    {
      version: "v0.2.0",
      sprint: t("releases.phase2"),
      date: "2026-03",
      accent: "from-rose-500 to-red-500",
      highlights: [t("v02.i2v"), t("v02.presets")],
    },
    {
      version: "v0.1.0",
      sprint: t("releases.phase1"),
      date: "2026-02",
      accent: "from-pink-500 to-rose-500",
      highlights: [t("v01.face"), t("v01.wizard")],
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-16 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/home"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>

        <header className="mb-12">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs uppercase tracking-wider text-violet-300">
            <Sparkles className="h-3 w-3" />
            {t("badge")}
          </div>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">{t("title")}</h1>
          <p className="mt-3 max-w-xl text-base text-slate-400">{t("subtitle")}</p>
        </header>

        <div className="relative space-y-8 border-l border-slate-800 pl-8">
          {releases.map((r, i) => (
            <article key={r.version} className="relative">
              <div
                className={`absolute -left-[42px] top-2 h-3 w-3 rounded-full bg-gradient-to-br ${r.accent} ring-4 ring-slate-950`}
              />
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6 backdrop-blur-xl">
                <div className="mb-3 flex flex-wrap items-baseline gap-3">
                  <span
                    className={`rounded-md bg-gradient-to-r px-2 py-0.5 text-xs font-bold text-white ${r.accent}`}
                  >
                    {r.version}
                  </span>
                  <h2 className="text-lg font-semibold text-white">{r.sprint}</h2>
                  <span className="ml-auto text-xs text-slate-500">{r.date}</span>
                </div>
                <ul className="space-y-2">
                  {r.highlights.map((h, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2 text-sm text-slate-300"
                    >
                      {i === 0 ? (
                        <Rocket className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                      ) : (
                        <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      )}
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-slate-500">{t("footer")}</p>
      </div>
    </main>
  );
}
