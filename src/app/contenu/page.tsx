import Link from "next/link";

import { AppFrame } from "@/components/app-frame";
import { IconPlus } from "@/components/icons";
import { InfluencerGrid } from "@/components/influencer-grid";
import { formatById } from "@/lib/formats";
import { requireUserId } from "@/lib/session";
import { listCharacters } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Créer du contenu",
};

type PageProps = { searchParams: Promise<{ format?: string; reel?: string; tag?: string }> };

export default async function ContentPage({ searchParams }: PageProps) {
  const userId = await requireUserId();
  const characters = await listCharacters(userId);
  const query = await searchParams;
  const format = formatById(query.format ?? "");
  const reelQuery =
    query.reel && query.tag
      ? `?reel=${encodeURIComponent(query.reel)}&tag=${encodeURIComponent(query.tag)}`
      : format
        ? `?format=${format.id}`
        : "";

  const description = query.reel
    ? `Choisis l’influenceuse qui refait ce reel #${query.tag}.`
    : format
      ? `Choisis l’influenceuse qui refait un ${format.label}.`
      : "Choisis l’influenceuse, puis le format. Le visage reste le même.";

  return (
    <AppFrame title="Créer du contenu" description={description}>
      {characters.length === 0 ? (
        <section className="panel mt-12 flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-md">
            <h2 className="font-display text-2xl font-bold tracking-tight uppercase">Crée d’abord une influenceuse.</h2>
            <p className="mt-3 text-sm text-pretty text-mute">
              Le contenu part d’un visage verrouillé et d’une niche.
            </p>
          </div>
          <Link href="/creer" className="btn btn-primary ring-focus pl-4 pr-2">
            Nouvelle
            <span className="btn-icon">
              <IconPlus size={14} />
            </span>
          </Link>
        </section>
      ) : (
        <InfluencerGrid
          characters={characters}
          showNew={false}
          nicheGate
          pathSuffix={`/contenu${reelQuery}`}
        />
      )}
    </AppFrame>
  );
}
