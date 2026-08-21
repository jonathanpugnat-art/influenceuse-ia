"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MessageSquareText, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { VoicePicker } from "@/components/talking-head/voice-picker";
import { TalkingHeadStudio } from "@/components/talking-head/talking-head-studio";

export default function TalkingHeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: influencer, isLoading, error } = trpc.influencer.getById.useQuery({ id });

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
        <div className="flex items-center gap-2 text-violet-300">
          <MessageSquareText className="h-5 w-5" />
          <h1 className="text-2xl font-bold text-white">Fais-le parler</h1>
          <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
            V1
          </span>
        </div>
        <p className="max-w-2xl text-sm text-slate-400">
          Ton personnage lit un script court face caméra. 9:16, 720p, ≤ 30&nbsp;s. La voix est cheirée sur
          le personnage (clone ou bibliothèque ElevenLabs) et réutilisée pour chaque prise.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Voix du personnage
          </h2>
          <VoicePicker influencerId={id} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Script &amp; génération
          </h2>
          <TalkingHeadStudio influencerId={id} />
        </section>
      </div>
    </div>
  );
}
