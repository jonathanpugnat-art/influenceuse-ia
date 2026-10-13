import Link from "next/link";

import { AppFrame } from "@/components/app-frame";
import { IconArrowRight, IconExternal, IconPlay } from "@/components/icons";
import { TrendScraper } from "@/components/trend-scraper";
import { FORMATS } from "@/lib/formats";
import { requireSession } from "@/lib/session";
import { listTrends } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tendances",
};

const views = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

export default async function TrendsPage() {
  await requireSession();
  const trends = await listTrends();

  return (
    <AppFrame
      title="Tendances"
      description="Les reels qui prennent des vues sur un hashtag. On reprend la structure, le visage reste celui de l’influenceuse."
    >
      <TrendScraper />

      {trends.map((trend) => (
        <section key={trend.hashtag} className="mt-14">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl font-bold tracking-tight uppercase">#{trend.hashtag}</h2>
            <p className="tabular text-sm text-mute">{trend.reels.length} reels</p>
          </div>
          {trend.reels.length === 0 ? (
            <p className="mt-4 text-sm text-mute">Aucun reel vidéo remonté.</p>
          ) : (
            <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {trend.reels.map((reel) => (
                <li key={reel.id} className="group relative overflow-hidden rounded-sm bg-raise">
                  <a
                    href={reel.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ring-focus block"
                    aria-label={`Ouvrir le reel de @${reel.owner} sur Instagram`}
                  >
                    {reel.thumbnail ? (
                      <img
                        src={reel.thumbnail}
                        alt=""
                        width={540}
                        height={960}
                        className="zoom-media aspect-[9/16] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[9/16] w-full items-center justify-center text-dim">
                        <IconPlay size={28} />
                      </div>
                    )}
                    <span className="tabular absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-sm bg-stage/90 px-2.5 py-1 text-xs">
                      <IconPlay size={12} className="text-lime" />
                      {views.format(reel.plays)}
                    </span>
                    <span className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-sm bg-stage/90 text-mute opacity-0 transition-opacity group-hover:opacity-100">
                      <IconExternal size={14} />
                    </span>
                  </a>
                  <div className="veil pointer-events-none absolute inset-x-0 bottom-0 p-4 pt-16">
                    <p className="line-clamp-2 text-sm text-pretty">{reel.caption || `@${reel.owner}`}</p>
                    <p className="mt-1 text-xs text-mute">@{reel.owner}</p>
                  </div>
                  <Link
                    href={`/contenu?reel=${reel.id}&tag=${trend.hashtag}`}
                    className="btn btn-primary ring-focus absolute right-3 bottom-3 px-3.5 py-2 text-xs"
                  >
                    Refaire
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="mt-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-bold tracking-tight uppercase">Formats qui marchent</h2>
          <p className="text-sm text-mute">Sans scraping, tout de suite.</p>
        </div>
        <ul className="panel mt-6 divide-y divide-line overflow-hidden">
          {FORMATS.map((format) => (
            <li key={format.id}>
              <Link
                href={`/contenu?format=${format.id}`}
                className="group shift ring-focus flex items-center justify-between gap-6 px-5 py-4 hover:bg-white/4 md:px-6"
              >
                <div className="min-w-0">
                  <p className="font-display text-lg font-medium">{format.label}</p>
                  <p className="mt-0.5 text-sm text-pretty text-mute">{format.reach}</p>
                </div>
                <span className="shift flex shrink-0 items-center gap-2 text-sm text-mute group-hover:text-lime">
                  Refaire
                  <span className="btn-icon bg-white/8 group-hover:bg-lime-soft">
                    <IconArrowRight size={14} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </AppFrame>
  );
}
