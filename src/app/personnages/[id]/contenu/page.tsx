import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { IconArrowLeft } from "@/components/icons";
import { NicheForm } from "@/components/niche-form";
import { PostCreator } from "@/components/post-creator";
import { formatById } from "@/lib/formats";
import { requireUserId } from "@/lib/session";
import { getOwnedCharacter, readNiche, readTrend } from "@/lib/storage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string; reel?: string; tag?: string }>;
};

export default async function ContentPage({ params, searchParams }: PageProps) {
  const userId = await requireUserId();
  const { id } = await params;
  const character = await getOwnedCharacter(id, userId);
  if (!character) notFound();
  const niche = await readNiche(character.id);
  const query = await searchParams;
  const format = formatById(query.format ?? "");
  const trend = query.tag && query.reel ? await readTrend(query.tag) : null;
  const reel = trend?.reels.find((item) => item.id === query.reel) ?? null;

  return (
    <AppShell>
      {niche ? (
        <PostCreator
          characterId={character.id}
          name={character.name}
          formatId={format?.id}
          reel={reel}
        />
      ) : (
        <main className="page-in mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col justify-center px-5 py-12 md:px-10">
          <Link
            href={`/personnages/${character.id}`}
            className="shift ring-focus inline-flex items-center gap-2 self-start rounded-md text-sm text-mute hover:text-ink"
          >
            <IconArrowLeft size={16} />
            {character.name}
          </Link>
          <h1 className="font-display mt-6 text-4xl font-medium tracking-tight">La niche d’abord</h1>
          <p className="mt-3 max-w-lg text-base text-pretty text-mute">
            Elle donne le sujet, le public et le ton de chaque post. Quatre lignes suffisent.
          </p>
          <div className="panel mt-8 p-6 md:p-8">
            <NicheForm characterId={character.id} initial={null} />
          </div>
        </main>
      )}
    </AppShell>
  );
}
