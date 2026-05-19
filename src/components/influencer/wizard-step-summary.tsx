"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Grid3x3,
  Bookmark,
  UserSquare2,
  Lock,
  Users,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  InstagramIcon,
  TikTokIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";
import { trpc } from "@/lib/trpc";
import { nicheConfig, formatFollowers } from "@/lib/influencer-utils";
import { useUpgradeOnLimitError } from "@/hooks/use-upgrade-on-limit-error";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const placeholderGradients = [
  "from-violet-600 to-indigo-600",
  "from-pink-600 to-rose-600",
  "from-blue-600 to-cyan-600",
  "from-emerald-600 to-teal-600",
];

/**
 * Sprint 12 — Step 4 redesigned as a "fake Instagram profile" mockup.
 *
 * Why: the previous text-based summary felt like a settings recap, not a
 * launch. Showing the influencer as if she/he were already on Instagram —
 * with bio, handle, follower stats and a 3×3 grid hinting at upcoming posts —
 * triggers the emotion that pushes users to click the final "Create" button.
 */
export function WizardStepSummary({ onPrev }: { onPrev: () => void }) {
  const router = useRouter();
  const { data, generatedImages, selectedImageIndex, reset, setStep } =
    useInfluencerWizard();

  // Sprint 14 — uniqueness guard: query how many OTHER active influencers
  // across the platform share the same appearance fingerprint and show a
  // soft warning before the user commits. Privacy-friendly: only a count
  // is returned, never the other rows. Skipped silently when the wizard
  // didn't generate a portrait (no fingerprint available).
  const collisionQuery = trpc.influencer.checkAppearanceCollision.useQuery(
    { fingerprint: data.appearanceFingerprint ?? "" },
    {
      enabled: Boolean(data.appearanceFingerprint),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    }
  );
  const collisionCount = collisionQuery.data?.count ?? 0;
  const hasCollision = collisionQuery.data?.hasCollision ?? false;

  const niche = nicheConfig[data.niche] ?? {
    label: data.niche,
    text: "text-slate-400",
    bg: "bg-slate-800",
  };

  const t = useTranslations("wizard");
  const tInfluencer = useTranslations("influencer");
  const handleUpgrade = useUpgradeOnLimitError();
  const createMutation = trpc.influencer.create.useMutation({
    onSuccess: (inf) => {
      toast.success(t("firstPhotoCta", { name: inf.name }));
      reset();
      // Sprint 15 — land on the photo creator with the new influencer
      // pre-selected so the wizard doesn't dead-end on an empty profile.
      router.push(`/content/photo?influencer=${inf.id}&welcome=1`);
    },
    onError: (err) => {
      if (handleUpgrade(err.message)) return;
      toast.error(err.message);
    },
  });

  const selectedImageUrl =
    data.baseImageUrl || (generatedImages[selectedImageIndex] ?? null);

  const handleCreate = () => {
    // Sprint 14 — collect the toggles + handles from wizard step 3 and
    // forward them to the backend. Previously dropped silently, which is
    // why users saw empty "Réseaux" panels right after creating an
    // influencer (Grok audit P1). Only platforms toggled on AND with a
    // non-empty handle are sent; the backend de-dupes + strips '@'.
    const socialAccounts: Array<{
      platform: "INSTAGRAM" | "TIKTOK" | "ONLYFANS";
      username: string;
    }> = [];
    if (data.instagramEnabled && data.instagramUsername?.trim()) {
      socialAccounts.push({
        platform: "INSTAGRAM",
        username: data.instagramUsername.trim(),
      });
    }
    if (data.tiktokEnabled && data.tiktokUsername?.trim()) {
      socialAccounts.push({
        platform: "TIKTOK",
        username: data.tiktokUsername.trim(),
      });
    }
    if (data.onlyfansEnabled && data.onlyfansUsername?.trim()) {
      socialAccounts.push({
        platform: "ONLYFANS",
        username: data.onlyfansUsername.trim(),
      });
    }

    createMutation.mutate({
      name: data.name,
      gender: data.gender,
      bio: data.bio,
      personality: data.personality,
      niche: data.niche as "FASHION",
      age: data.age,
      style: {
        ethnicity: data.ethnicity || undefined,
        hairColor: data.hairColor || undefined,
        hairStyle:
          [data.hairLength, data.hairTexture].filter(Boolean).join(", ") ||
          undefined,
        bodyType: data.bodyType || undefined,
        fashionStyle: (data.fashionStyles ?? []).join(", ") || undefined,
      },
      isNsfw: data.isNsfw,
      baseImageUrl: selectedImageUrl || undefined,
      avatarUrl: selectedImageUrl || undefined,
      appearanceVariations: data.appearanceVariations,
      appearanceFingerprint: data.appearanceFingerprint,
      socialAccounts: socialAccounts.length > 0 ? socialAccounts : undefined,
    });
  };

  // Pretend follower count: deterministic per name so the demo "feels real"
  // but is stable across re-renders. Numbers picked to look like a fresh
  // micro-influencer (1.5k–25k range).
  const fakeStats = useMemo(() => {
    const seed = (data.name || "x")
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const followers = 1500 + (seed * 137) % 23500;
    const following = 200 + (seed * 31) % 600;
    const posts = 9; // Matches the 3×3 mockup grid.
    return { followers, following, posts };
  }, [data.name]);

  // Instagram handle preview: prefer the username they entered, otherwise
  // derive from the name (lowercased, no spaces) — same heuristic Instagram
  // suggests when you create an account.
  const handle = useMemo(() => {
    if (data.instagramUsername?.trim()) {
      return data.instagramUsername.replace(/^@/, "");
    }
    const slug = (data.name || "your_handle")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_.]/g, "");
    return slug || "your_handle";
  }, [data.name, data.instagramUsername]);

  return (
    <div className="space-y-6">
      {/* Mockup Instagram profile card */}
      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-violet-500/10">
          {/* Phone notch / header */}
          <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <InstagramIcon className="h-4 w-4 text-pink-400" />
              <span className="tracking-tight">{handle}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span className="text-base">≡</span>
            </div>
          </div>

          {/* Profile header */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-4">
              {/* Avatar with story-ring */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-500 p-[2.5px]">
                  <div className="h-full w-full rounded-full bg-slate-950" />
                </div>
                {selectedImageUrl ? (
                  <img
                    src={selectedImageUrl}
                    alt=""
                    className="relative h-20 w-20 rounded-full object-cover ring-2 ring-slate-950"
                  />
                ) : (
                  <div
                    className={cn(
                      "relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ring-2 ring-slate-950",
                      generatedImages.length > 0
                        ? placeholderGradients[selectedImageIndex] ??
                            placeholderGradients[0]
                        : "from-slate-700 to-slate-800"
                    )}
                  >
                    <span className="text-2xl font-bold text-white/40">
                      {data.name?.charAt(0) || "?"}
                    </span>
                  </div>
                )}
              </div>
              {/* Stats */}
              <div className="flex flex-1 justify-around text-center">
                <Stat label={t("posts")} value={fakeStats.posts} />
                <Stat
                  label={t("followers")}
                  value={fakeStats.followers}
                  format
                />
                <Stat
                  label={t("following")}
                  value={fakeStats.following}
                  format
                />
              </div>
            </div>

            {/* Name + bio */}
            <div className="mt-3 space-y-1">
              <p className="text-sm font-semibold text-white">
                {data.name || t("noName")}
              </p>
              <Badge
                className={cn(
                  "border px-2 py-0 text-[10px] font-semibold uppercase tracking-wide",
                  niche.bg,
                  niche.text
                )}
              >
                {niche.label}
              </Badge>
              <p className="whitespace-pre-line pt-1 text-xs leading-relaxed text-slate-200">
                {data.bio || t("bioComingSoon")}
              </p>
            </div>

            {/* Action buttons mockup */}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled
                className="flex-1 rounded-lg bg-violet-500 py-1.5 text-xs font-semibold text-white"
              >
                {t("follow")}
              </button>
              <button
                type="button"
                disabled
                className="flex-1 rounded-lg bg-slate-800 py-1.5 text-xs font-semibold text-slate-200"
              >
                {t("message")}
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200"
              >
                +
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="grid grid-cols-3 border-b border-slate-800/60 text-slate-500">
            <div className="flex items-center justify-center border-b-2 border-white py-2 text-white">
              <Grid3x3 className="h-4 w-4" />
            </div>
            <div className="flex items-center justify-center py-2">
              <UserSquare2 className="h-4 w-4" />
            </div>
            <div className="flex items-center justify-center py-2">
              <Bookmark className="h-4 w-4" />
            </div>
          </div>

          {/* 3×3 grid */}
          <div className="grid grid-cols-3 gap-[2px] bg-slate-800/40 p-[2px]">
            {Array.from({ length: 9 }).map((_, i) => {
              // Repeat the chosen base image on the first cell, then alternate
              // with locked placeholder tiles for the "to be generated" feel.
              const isHero = i === 0 && selectedImageUrl;
              return (
                <div
                  key={i}
                  className={cn(
                    "relative aspect-square overflow-hidden bg-slate-900",
                    isHero && "ring-1 ring-violet-500/40"
                  )}
                >
                  {isHero ? (
                    <img
                      src={selectedImageUrl ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800/70">
                      <Lock className="h-3 w-3 text-slate-700" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer caption */}
          <div className="border-t border-slate-800/60 px-4 py-3 text-center">
            <p className="text-[11px] italic text-slate-500">
              {t("nextPostsHint")}
            </p>
          </div>
        </div>
      </div>

      {/* Connected platforms summary */}
      <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-2">
        {data.instagramEnabled && (
          <PlatformPill
            icon={<InstagramIcon className="h-3.5 w-3.5 text-pink-400" />}
            label={data.instagramUsername || tInfluencer("instagram")}
          />
        )}
        {data.tiktokEnabled && (
          <PlatformPill
            icon={<TikTokIcon className="h-3.5 w-3.5 text-white" />}
            label={data.tiktokUsername || tInfluencer("tiktok")}
          />
        )}
        {data.onlyfansEnabled && (
          <PlatformPill
            icon={<OnlyFansIcon className="h-3.5 w-3.5 text-blue-400" />}
            label={data.onlyfansUsername || tInfluencer("onlyfans")}
          />
        )}
        {!data.instagramEnabled &&
          !data.tiktokEnabled &&
          !data.onlyfansEnabled && (
            <p className="text-xs italic text-slate-500">{t("noSocialYet")}</p>
          )}
      </div>

      {/* Personality recap (collapsed details) */}
      {data.personality && (
        <details className="mx-auto max-w-md rounded-xl border border-slate-800/50 bg-slate-900/50 p-4 text-sm text-slate-300">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("personality")}
          </summary>
          <p className="mt-2 leading-relaxed">{data.personality}</p>
        </details>
      )}

      {/* Sprint 14 — duplicate appearance warning (soft, non-blocking).
          Tells the user how many other creators share the same visual
          fingerprint and offers a "back to step 2" CTA to re-roll. */}
      {hasCollision && (
        <div className="mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-200">
              {collisionCount === 1
                ? "1 autre créateur a un profil très proche"
                : `${collisionCount} autres créateurs ont un profil très proche`}
            </p>
            <p className="mt-1 text-xs text-amber-200/80">
              Sa signature visuelle (visage, yeux, expression…) correspond à
              une influenceuse déjà active. Tu peux quand même créer la
              tienne, ou retourner à l&apos;étape apparence et cliquer{" "}
              <span className="font-medium">«&nbsp;Surprends-moi&nbsp;»</span>{" "}
              pour un look plus unique.
            </p>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-500/30"
            >
              <Sparkles className="h-3 w-3" />
              Re-tirer l&apos;apparence
            </button>
          </div>
        </div>
      )}

      {/* Create button */}
      <div className="mx-auto max-w-md space-y-3">
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

function Stat({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-base font-bold text-white">
        {format ? formatFollowers(value) : value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
    </div>
  );
}

function PlatformPill({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-slate-800/50 px-3 py-1.5">
      {icon}
      <span className="text-[11px] text-slate-300">{label}</span>
    </div>
  );
}
