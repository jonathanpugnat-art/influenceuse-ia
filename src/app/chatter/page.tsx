import Link from "next/link";

import { AppFrame } from "@/components/app-frame";
import { ChatterBox } from "@/components/chatter-box";
import { requireUserId } from "@/lib/session";
import { listCharacters } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chatter",
};

export default async function ChatterPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const userId = await requireUserId();
  const characters = await listCharacters(userId);
  const ready = characters.filter((character) => character.nicheSubject);
  const requested = (await searchParams).id;
  const selected = ready.find((character) => character.id === requested) ?? ready[0];

  return (
    <AppFrame
      title="Chatter"
      description={
        selected
          ? "Elle répond dans sa niche. Le message part d’ici, le compte OnlyFans reste sur OnlyFans."
          : "Définis d’abord la niche d’une influenceuse."
      }
    >
      {selected ? (
        <div className="mt-10 grid gap-8 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-12">
          <aside>
            <p className="text-sm text-mute">Qui répond</p>
            <ul className="mt-3 flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
              {ready.map((character) => {
                const active = character.id === selected.id;
                return (
                  <li key={character.id} className="shrink-0">
                    <Link
                      href={`/chatter?id=${character.id}`}
                      aria-current={active ? "page" : undefined}
                      className={`shift ring-focus flex items-center gap-3 rounded-sm px-2.5 py-2 ${
                        active ? "bg-white/6" : "hover:bg-white/4"
                      }`}
                    >
                      <img
                        src={`/api/characters/${character.id}/face`}
                        alt=""
                        width={40}
                        height={40}
                        className={`size-10 rounded-sm object-cover ${active ? "ring-2 ring-lime" : ""}`}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{character.name}</span>
                        <span className="block truncate text-xs text-mute">{character.nicheSubject}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>
          <div className="min-w-0 max-w-3xl">
            <ChatterBox key={selected.id} characterId={selected.id} name={selected.name} />
          </div>
        </div>
      ) : (
        <section className="panel mt-12 flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-md">
            <h2 className="font-display text-2xl font-bold tracking-tight uppercase">Aucune influenceuse prête.</h2>
            <p className="mt-3 text-sm text-pretty text-mute">
              La niche donne la voix. Sans elle, pas de réponse.
            </p>
          </div>
          <Link href="/" className="btn btn-ghost ring-focus">
            Voir les influenceuses
          </Link>
        </section>
      )}
    </AppFrame>
  );
}
