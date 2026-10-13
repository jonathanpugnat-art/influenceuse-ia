import Link from "next/link";

import { AppFrame } from "@/components/app-frame";
import { IconArrowRight } from "@/components/icons";
import { requireUserId } from "@/lib/session";
import { countPosts, listCharacters } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analytique",
};

export default async function AnalyticsPage() {
  const userId = await requireUserId();
  const [characters, posts] = await Promise.all([
    listCharacters(userId),
    countPosts(userId),
  ]);
  const ready = characters.filter((character) => character.nicheSubject).length;

  return (
    <AppFrame
      title="Analytique"
      description="Ce qui est en place. Les vues arriveront avec les comptes connectés."
    >
      <dl className="mt-10 grid grid-cols-3 divide-x divide-line rounded-sm border border-line bg-panel">
        {[
          { label: "Influenceuses", value: characters.length },
          { label: "Niches définies", value: ready },
          { label: "Posts créés", value: posts },
        ].map((stat) => (
          <div key={stat.label} className="px-5 py-6 md:px-8 md:py-8">
            <dt className="text-sm text-mute">{stat.label}</dt>
            <dd className="font-display tabular mt-3 text-4xl font-medium tracking-tight md:text-5xl">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {characters.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold tracking-tight uppercase">Par influenceuse</h2>
          <ul className="panel mt-6 divide-y divide-line overflow-hidden">
            {characters.map((character) => (
              <li key={character.id}>
                <Link
                  href={`/personnages/${character.id}`}
                  className="group shift ring-focus flex items-center gap-4 px-5 py-3.5 hover:bg-white/4 md:px-6"
                >
                  <img
                    src={`/api/characters/${character.id}/face`}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-sm object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{character.name}</span>
                    <span className={`block truncate text-sm ${character.nicheSubject ? "text-mute" : "text-lime"}`}>
                      {character.nicheSubject ?? "Niche à définir"}
                    </span>
                  </span>
                  <IconArrowRight size={16} className="shift text-dim group-hover:text-lime" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-10 max-w-md text-sm text-pretty text-mute">
          Rien à mesurer encore. Les influenceuses et leurs posts s’ajoutent ici.
        </p>
      )}
    </AppFrame>
  );
}
