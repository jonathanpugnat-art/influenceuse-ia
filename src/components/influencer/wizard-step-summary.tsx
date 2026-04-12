"use client";

import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  InstagramIcon,
  TikTokIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { trpc } from "@/lib/trpc";
import { nicheConfig } from "@/lib/influencer-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const placeholderGradients = [
  "from-violet-600 to-indigo-600",
  "from-pink-600 to-rose-600",
  "from-blue-600 to-cyan-600",
  "from-emerald-600 to-teal-600",
];

export function WizardStepSummary({ onPrev }: { onPrev: () => void }) {
  const router = useRouter();
  const { data, generatedImages, selectedImageIndex, reset } =
    useInfluencerWizard();

  const niche = nicheConfig[data.niche] ?? { label: data.niche, text: "text-slate-400", bg: "bg-slate-800" };

  const t = useTranslations("wizard");
  const tInfluencer = useTranslations("influencer");
  const createMutation = trpc.influencer.create.useMutation({
    onSuccess: (inf) => {
      toast.success(t("createdSuccess", { name: inf.name }));
      reset();
      router.push(`/influencers/${inf.id}`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const selectedImageUrl = data.baseImageUrl || (generatedImages[selectedImageIndex] ?? null);

  const handleCreate = () => {
    createMutation.mutate({
      name: data.name,
      bio: data.bio,
      personality: data.personality,
      niche: data.niche as "FASHION",
      age: data.age,
      style: {
        ethnicity: data.ethnicity || undefined,
        hairColor: data.hairColor || undefined,
        hairStyle: [data.hairLength, data.hairTexture].filter(Boolean).join(", ") || undefined,
        bodyType: data.bodyType || undefined,
        fashionStyle: (data.fashionStyles ?? []).join(", ") || undefined,
      },
      isNsfw: data.isNsfw,
      baseImageUrl: selectedImageUrl || undefined,
      avatarUrl: selectedImageUrl || undefined,
    });
  };

  const appearanceParts = [
    data.ethnicity,
    data.hairColor ? `Cheveux ${data.hairColor.toLowerCase()}` : null,
    data.hairLength?.toLowerCase(),
    data.hairTexture?.toLowerCase(),
    data.bodyType,
    data.fashionStyles.length > 0 ? data.fashionStyles.join(", ") : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl md:p-8">
        {/* Header: image + name */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          {selectedImageUrl ? (
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl ring-2 ring-violet-500/50">
              <img
                src={selectedImageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              className={cn(
                "flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-2 ring-violet-500/50",
                generatedImages.length > 0
                  ? placeholderGradients[selectedImageIndex] ?? placeholderGradients[0]
                  : "from-slate-700 to-slate-800"
              )}
            >
              <span className="text-3xl font-bold text-white/40">
                {data.name?.charAt(0) || "?"}
              </span>
            </div>
          )}
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-white">{data.name || t("noName")}</h2>
            <p className="mt-1 text-sm text-slate-400">{data.bio}</p>
          </div>
        </div>

        {/* Section: Identity */}
        <div className="mt-6 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("identitySection")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label={t("personality")} value={data.personality} />
            <InfoRow label={t("age")} value={`${data.age} ${t("years")}`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("border px-2.5 py-0.5 text-xs", niche.bg, niche.text)}>
              {niche.label}
            </Badge>
            <Badge
              className={cn(
                "border px-2.5 py-0.5 text-xs",
                data.isNsfw
                  ? "border-red-500/20 bg-red-500/10 text-red-400"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              )}
            >
              {data.isNsfw ? "NSFW" : "SFW"}
            </Badge>
          </div>
        </div>

        {/* Section: Appearance */}
        {appearanceParts.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("appearanceSection")}
          </h3>
            <p className="text-sm text-slate-300">
              {appearanceParts.join(" • ")}
            </p>
          </div>
        )}

        {/* Section: Social */}
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("socialSection")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.instagramEnabled && (
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-800/50 px-3 py-1.5">
                <InstagramIcon className="h-4 w-4 text-pink-400" />
                <span className="text-xs text-slate-300">
                  {data.instagramUsername || tInfluencer("instagram")}
                </span>
              </div>
            )}
            {data.tiktokEnabled && (
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-800/50 px-3 py-1.5">
                <TikTokIcon className="h-4 w-4 text-white" />
                <span className="text-xs text-slate-300">
                  {data.tiktokUsername || tInfluencer("tiktok")}
                </span>
              </div>
            )}
            {data.onlyfansEnabled && (
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-800/50 px-3 py-1.5">
                <OnlyFansIcon className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-slate-300">
                  {data.onlyfansUsername || tInfluencer("onlyfans")}
                </span>
              </div>
            )}
            {!data.instagramEnabled &&
              !data.tiktokEnabled &&
              !data.onlyfansEnabled && (
                <p className="text-xs italic text-slate-500">
                  {t("noSocialYet")}
                </p>
              )}
          </div>
        </div>
      </div>

      {/* Create button */}
      <div className="mx-auto max-w-2xl space-y-3">
        <button
          type="button"
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-500 bg-[length:200%_100%] px-6 py-4 text-base font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-violet-500/30 disabled:opacity-60 disabled:hover:scale-100"
          style={{
            animation: createMutation.isPending
              ? undefined
              : "gradient-shift 3s ease infinite",
          }}
        >
          {createMutation.isPending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {t("creating")}
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5" />
              {t("createMyInfluencer")}
            </>
          )}
        </button>
        <p className="text-center text-xs text-slate-500">
          {t("editLaterHint")}
        </p>
      </div>

      {/* Back button */}
      <div className="flex justify-start">
        <button
          type="button"
          onClick={onPrev}
          className="rounded-xl border border-slate-700 px-6 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          ← {t("back")}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800/30 p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-0.5 line-clamp-2 text-sm text-white">{value || "—"}</p>
    </div>
  );
}

