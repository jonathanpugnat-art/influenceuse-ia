"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Film, Loader2, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { SeedanceStudio } from "@/components/seedance/seedance-studio";

export default function SeedanceScenePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    data: influencer,
    isLoading,
    error,
  } = trpc.influencer.getById.useQuery({ id });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !influencer) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Users className="h-12 w-12 text-slate-600" />
        <h2 className="mt-4 text-lg font-semibold text-white">
          Influenceuse introuvable
        </h2>
        <Link
          href="/influencers"
          className="mt-4 text-sm text-violet-400 hover:underline"
        >
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/influencers/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {influencer.name}
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-fuchsia-300">
          <Film className="h-5 w-5" />
          <h1 className="text-2xl font-bold text-white">Vidéo scène</h1>
          <span className="rounded-md bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300">
            Seedance V1
          </span>
        </div>
        <p className="max-w-2xl text-sm text-slate-400">
          Ton personnage tient une scène de 10, 15 ou 30 secondes en 9:16 avec
          son audio natif (voix + ambiance). L&apos;identité est verrouillée
          via ton pack de portraits (@Image1, @Image2…). Rien à uploader —
          c&apos;est le remix qui prend un clip source, pas la scène.
        </p>
      </div>

      <SeedanceStudio influencerId={id} influencerName={influencer.name} />
    </div>
  );
}
