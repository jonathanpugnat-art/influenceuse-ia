import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import { AppFrame } from "@/components/app-frame";
import { IconPlus } from "@/components/icons";
import { InfluencerGrid } from "@/components/influencer-grid";
import { Landing } from "@/components/marketing/landing";
import { listCharacters } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { userId } = await auth();
  if (!userId) {
    return {
      title: { absolute: "Ofmia — Studio d’influenceuses IA" },
      description: "Un visage verrouillé, une niche, des posts Instagram prêts à publier.",
    };
  }
  return { title: "Influenceuses" };
}

export default async function HomePage() {
  const { userId } = await auth();

  // Visiteur déconnecté : landing publique de conversion.
  if (!userId) {
    return <Landing />;
  }

  const characters = await listCharacters(userId);
  const ready = characters.filter((character) => character.nicheSubject).length;

  return (
    <AppFrame
      title="Influenceuses"
      description={
        characters.length === 0
          ? "Un visage verrouillé, une niche, puis du contenu qui marche déjà sur Instagram."
          : `${characters.length} ${characters.length > 1 ? "visages" : "visage"}, ${ready} ${ready > 1 ? "prêtes" : "prête"} à publier.`
      }
      action={
        <Link href="/creer" className="btn btn-primary ring-focus pl-4 pr-2">
          Nouvelle
          <span className="btn-icon">
            <IconPlus size={14} />
          </span>
        </Link>
      }
    >
      {characters.length === 0 ? (
        <section className="panel mt-12 flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-md">
            <h2 className="font-display text-2xl font-bold tracking-tight uppercase text-balance">
              Aucune influenceuse pour l’instant.
            </h2>
            <p className="mt-3 text-sm text-pretty text-mute">
              Invente un visage à partir de traits, ou clone-le à partir de tes photos. Il reste le
              même sur chaque post.
            </p>
          </div>
          <Link href="/creer" className="btn btn-primary ring-focus pl-4 pr-2">
            Créer la première
            <span className="btn-icon">
              <IconPlus size={14} />
            </span>
          </Link>
        </section>
      ) : (
        <InfluencerGrid characters={characters} />
      )}
    </AppFrame>
  );
}
