import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { IconArrowLeft, IconChat, IconSpark } from "@/components/icons";
import { IdentityRefsPanel } from "@/components/identity-refs-panel";
import { LoraPanel } from "@/components/lora-panel";
import { NicheForm } from "@/components/niche-form";
import { requireUserId } from "@/lib/session";
import { getOwnedCharacter, readNiche } from "@/lib/storage";
import { traitLabel, type TraitKey } from "@/lib/traits";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const userId = await requireUserId();
  const character = await getOwnedCharacter(id, userId);
  return { title: character?.name ?? "Influenceuse" };
}

function portraitLine(traits: Record<string, string>): string {
  const value = (key: TraitKey) => traitLabel(key, traits[key] ?? "").toLowerCase();
  const eyes = value("eyes") === "vert" ? "verts" : value("eyes") === "bleu" ? "bleus" : value("eyes");
  const gender = value("gender");
  const named = `${gender.charAt(0).toUpperCase()}${gender.slice(1)}`;
  return `${named}, ${value("age")}, yeux ${eyes}, cheveux ${value("hairLength")} ${value("hairColor")}, corps ${value("body")}, peau ${value("skin")}.`;
}

export default async function CharacterPage({ params }: PageProps) {
  const userId = await requireUserId();
  const { id } = await params;
  const character = await getOwnedCharacter(id, userId);
  if (!character) notFound();
  const niche = await readNiche(character.id);

  const created = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
  }).format(new Date(character.createdAt));
  const origin = character.door === "builder" ? "Inventée" : "Clonée";

  return (
    <AppShell>
      <main className="page-in mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-12">
        <Link
          href="/"
          className="shift ring-focus inline-flex items-center gap-2 rounded-md text-sm text-mute hover:text-ink"
        >
          <IconArrowLeft size={16} />
          Influenceuses
        </Link>

        <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-14">
          <div className="md:sticky md:top-12 md:self-start">
            <div className="bezel face-in shadow-stage">
              <div className="bezel-core signal">
                <img
                  src={`/api/characters/${character.id}/face`}
                  alt={`Visage de ${character.name}`}
                  width={768}
                  height={1024}
                  className="aspect-[3/4] w-full object-cover"
                />
              </div>
            </div>
            <p className="mt-4 text-sm text-mute">
              {origin} le {created}
            </p>
          </div>

          <div className="min-w-0">
            <h1 className="font-display text-4xl font-medium tracking-tight text-balance md:text-6xl">
              {character.name}
            </h1>
            <p className="mt-4 max-w-xl text-base text-pretty text-mute">
              {character.door === "builder" && character.traits
                ? portraitLine(character.traits)
                : `${character.sources.length} photos de référence. La photo choisie est le visage.`}
            </p>

            <section className="panel mt-10 p-6 md:p-8">
              <div className="flex items-baseline justify-between gap-6">
                <h2 className="font-display text-2xl font-bold tracking-tight uppercase">Niche</h2>
                <p className="text-sm text-mute">
                  {niche ? "Elle guide chaque post et chaque réponse." : "Elle débloque le contenu."}
                </p>
              </div>
              <div className="mt-6">
                <NicheForm characterId={character.id} initial={niche} />
              </div>
            </section>

            <IdentityRefsPanel characterId={character.id} />
            <LoraPanel
              characterId={character.id}
              door={character.door}
              sourceCount={character.sources.length}
            />

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {niche ? (
                <>
                  <Link
                    href={`/personnages/${character.id}/contenu`}
                    className="btn btn-primary ring-focus pl-4 pr-2"
                  >
                    Créer un post
                    <span className="btn-icon">
                      <IconSpark size={14} />
                    </span>
                  </Link>
                  <Link href={`/chatter?id=${character.id}`} className="btn btn-ghost ring-focus pl-4 pr-2">
                    Chatter
                    <span className="btn-icon">
                      <IconChat size={14} />
                    </span>
                  </Link>
                </>
              ) : (
                <p className="text-sm text-mute">Garde la niche pour créer le premier post.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
