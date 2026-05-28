"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  X,
  Calendar,
  Package,
  Info,
  Instagram,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InstagramIcon,
  TikTokIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { buildPhotoContentDescription } from "@/lib/photo-content-context";
import {
  CAPTION_TONES,
  captionToneHint,
  type CaptionToneId,
} from "@/lib/caption-tones";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function mergeScheduleDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;
  const [h, min] = (timeStr || "19:00").split(":").map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(h || 19, min || 0, 0, 0);
  return d;
}

export function PhotoPublish({ mobileSheet = false }: { mobileSheet?: boolean }) {
  const t = useTranslations("content");
  const {
    params,
    contentId,
    caption,
    hashtags,
    platforms,
    scheduledAt,
    setCaption,
    setHashtags,
    setPlatforms,
    setScheduledAt,
  } = usePhotoCreator();

  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [captionPlatform, setCaptionPlatform] = useState("INSTAGRAM");
  const [hashtagInput, setHashtagInput] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("19:00");
  const [isGenCaption, setIsGenCaption] = useState(false);
  const [isGenHashtags, setIsGenHashtags] = useState(false);
  // Sprint 8 — A/B variants of the caption.
  const [variants, setVariants] = useState<string[] | null>(null);
  const [isGenVariants, setIsGenVariants] = useState(false);
  const [captionTone, setCaptionTone] = useState<CaptionToneId>("casual");

  const captionMutation = trpc.content.generateCaption.useMutation();
  const variantsMutation = trpc.content.generateCaptionVariants.useMutation();
  const hashtagMutation = trpc.content.generateHashtags.useMutation();
  const updateMutation = trpc.content.updateContent.useMutation();
  const publishNowMutation = trpc.publish.publishNow.useMutation();
  const scheduleMutation = trpc.publish.scheduleContent.useMutation();
  const bundleMutation = trpc.content.prepareOnlyFansBundle.useMutation();

  const influencersQuery = trpc.influencer.getAll.useQuery({ limit: 50 });
  const selectedInf = influencersQuery.data?.influencers?.find(
    (i) => i.id === params.influencerId
  );

  // Pre-flight readiness check — fires once we have an influencer + a non-
  // empty platform selection. Re-runs whenever either changes. Result is
  // used to render a warning block above the publish button so the user
  // never clicks "Publish" only to see it fail silently in the cron later.
  const readinessQuery = trpc.publish.checkPublishReadiness.useQuery(
    {
      influencerId: params.influencerId ?? "",
      platforms: platforms as ("INSTAGRAM" | "TIKTOK" | "ONLYFANS")[],
    },
    {
      enabled: Boolean(params.influencerId) && platforms.length > 0,
      staleTime: 30_000,
    }
  );
  const instagramSelected = platforms.includes("INSTAGRAM");
  const instagramCheck = readinessQuery.data?.checks.find(
    (c) => c.platform === "INSTAGRAM"
  );

  const slotsQuery = trpc.analytics.suggestSlots.useQuery(
    {
      influencerId: params.influencerId,
      count: 1,
    },
    {
      enabled:
        scheduleMode === "schedule" &&
        Boolean(params.influencerId) &&
        instagramSelected,
      staleTime: 60_000,
    }
  );

  useEffect(() => {
    if (scheduleMode !== "schedule") return;
    const slot = slotsQuery.data?.[0];
    if (!slot) return;
    const at = new Date(slot.at);
    setScheduleDate(toDateInputValue(at));
    setScheduleTime(toTimeInputValue(at));
    setScheduledAt(at);
  }, [scheduleMode, slotsQuery.data, setScheduledAt]);

  useEffect(() => {
    if (scheduleMode !== "schedule") return;
    const merged = mergeScheduleDateTime(scheduleDate, scheduleTime);
    if (merged) setScheduledAt(merged);
  }, [scheduleDate, scheduleTime, scheduleMode, setScheduledAt]);

  const publishReminders = useMemo(() => {
    const items: string[] = [];
    if (!contentId) items.push(t("publishReminderNeedMedia"));
    if (platforms.length === 0) items.push(t("publishReminderNeedPlatform"));
    if (instagramSelected && instagramCheck && !instagramCheck.ok) {
      items.push(instagramCheck.reason ?? t("publishConnectInstagram"));
    }
    if (instagramSelected && !caption.trim()) {
      items.push(t("publishReminderCaption"));
    }
    return items;
  }, [contentId, platforms.length, instagramSelected, instagramCheck, caption, t]);

  const photoContentDescription = useCallback(
    () =>
      buildPhotoContentDescription(
        {
          scene: params.scene,
          sceneDescription: params.sceneDescription,
          pose: params.pose,
          outfit: params.outfit,
          expression: params.expression,
          photoStyle: params.photoStyle,
          timeOfDay: params.timeOfDay,
          location: params.location,
          customPrompt: params.customPrompt,
          contentMode: params.contentMode,
          nsfwLevel: params.nsfwLevel,
        },
        language
      ),
    [params, language]
  );

  // Premium lane → OnlyFans by default (single-influencer OF workflow).
  useEffect(() => {
    if (params.contentMode !== "NSFW") return;
    setCaptionPlatform("ONLYFANS");
    setPlatforms(
      platforms.includes("ONLYFANS") ? platforms : ["ONLYFANS"]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when entering Premium lane
  }, [params.contentMode]);

  const captionDescriptionWithTone = useCallback(
    () => `${photoContentDescription()}\n\nTone: ${captionToneHint(captionTone)}`,
    [photoContentDescription, captionTone]
  );

  // Generate caption
  const handleGenCaption = useCallback(async () => {
    if (!params.influencerId) return;
    setIsGenCaption(true);
    try {
      const result = await captionMutation.mutateAsync({
        influencerId: params.influencerId,
        contentDescription: captionDescriptionWithTone(),
        platform: captionPlatform as "INSTAGRAM",
        language,
      });
      // Typing animation
      setCaption("");
      const chars = result.caption.split("");
      for (let i = 0; i < chars.length; i++) {
        await new Promise((r) => setTimeout(r, 15));
        setCaption(result.caption.slice(0, i + 1));
      }
    } catch (err) {
      toast.error("Erreur lors de la génération de la caption");
    } finally {
      setIsGenCaption(false);
    }
  }, [
    params.influencerId,
    captionPlatform,
    language,
    captionMutation,
    setCaption,
    captionDescriptionWithTone,
  ]);

  // Sprint 8 — Generate 2 A/B caption variants the user can pick from.
  const handleGenVariants = useCallback(async () => {
    if (!params.influencerId) return;
    setIsGenVariants(true);
    setVariants(null);
    try {
      const result = await variantsMutation.mutateAsync({
        influencerId: params.influencerId,
        contentDescription: captionDescriptionWithTone(),
        platform: captionPlatform as "INSTAGRAM",
        language,
      });
      setVariants(result.variants);
    } catch {
      toast.error("Erreur lors de la génération des variantes");
    } finally {
      setIsGenVariants(false);
    }
  }, [
    params.influencerId,
    captionPlatform,
    language,
    variantsMutation,
    captionDescriptionWithTone,
  ]);

  const pickVariant = (text: string) => {
    setCaption(text);
    setVariants(null);
  };

  // Generate hashtags
  const handleGenHashtags = useCallback(async () => {
    if (!selectedInf) return;
    setIsGenHashtags(true);
    try {
      const result = await hashtagMutation.mutateAsync({
        niche: selectedInf.niche,
        platform: captionPlatform as "INSTAGRAM",
        description: photoContentDescription(),
        count: 15,
      });
      setHashtags(result.hashtags.map((h) => h.replace(/^#/, "")));
    } catch {
      toast.error("Erreur lors de la génération des hashtags");
    } finally {
      setIsGenHashtags(false);
    }
  }, [
    selectedInf,
    captionPlatform,
    hashtagMutation,
    setHashtags,
    photoContentDescription,
  ]);

  // Add hashtag manually
  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (tag && !hashtags.includes(tag)) {
      setHashtags([...hashtags, tag]);
      setHashtagInput("");
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((h) => h !== tag));
  };

  // Toggle platform
  const togglePlatform = (p: string) => {
    setPlatforms(
      platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p]
    );
  };

  // Save / Publish — Instagram immédiat passe par publishNow (API Meta), pas un simple statut PUBLISHED.
  const handleSave = async (publish: boolean) => {
    if (!contentId) return;
    const platformList =
      platforms.length > 0
        ? (platforms as ("INSTAGRAM" | "TIKTOK" | "ONLYFANS")[])
        : [];

    try {
      await updateMutation.mutateAsync({
        contentId,
        caption: caption || undefined,
        hashtags: hashtags.length > 0 ? hashtags : undefined,
        platforms: platformList.length > 0 ? platformList : undefined,
        status: publish ? "READY" : "DRAFT",
        scheduledAt: null,
      });

      if (!publish) {
        toast.success("Brouillon sauvegardé !");
        return;
      }

      if (scheduleMode === "schedule" && scheduledAt) {
        if (platformList.length === 0) {
          toast.error("Choisis au moins une plateforme");
          return;
        }
        await scheduleMutation.mutateAsync({
          contentId,
          platforms: platformList,
          scheduledAt: scheduledAt.toISOString(),
        });
        toast.success("Contenu programmé !");
        return;
      }

      const igPlatforms = platformList.filter((p) => p === "INSTAGRAM");
      if (igPlatforms.length > 0) {
        if (instagramCheck && !instagramCheck.ok) {
          toast.error(
            instagramCheck.reason ??
              "Instagram n’est pas prêt (connexion ou média manquant)."
          );
          return;
        }
        const { results } = await publishNowMutation.mutateAsync({
          contentId,
          platforms: igPlatforms,
        });
        const failed = results.filter((r) => r.status === "FAILED");
        if (failed.length > 0) {
          toast.error(failed[0]?.error ?? "Échec de publication Instagram");
          return;
        }
        toast.success("Publié sur Instagram !");
        return;
      }

      await updateMutation.mutateAsync({ contentId, status: "PUBLISHED" });
      toast.success("Contenu enregistré — publication manuelle sur les apps");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la sauvegarde";
      toast.error(msg);
    }
  };

  // OF bundle
  const handleOFBundle = async () => {
    if (!contentId) return;
    try {
      const result = await bundleMutation.mutateAsync({ contentId });
      window.open(result.downloadUrl, "_blank");
      toast.success("Pack OnlyFans prêt !");
    } catch {
      toast.error("Erreur lors de la création du pack");
    }
  };

  return (
    <motion.div
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={cn(
        "h-full overflow-y-auto bg-slate-900/30 p-4 scrollbar-thin",
        mobileSheet ? "" : "border-l border-slate-800/50"
      )}
    >
      {mobileSheet && (
        <div
          className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-600"
          aria-hidden
        />
      )}
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-500">
        {t("publishPanelTitle")}
      </h2>
      <p className="mb-4 text-[11px] leading-snug text-slate-600">
        {t("publishPanelStudioHint")}
      </p>

      <div className="space-y-5">
        {/* Caption */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">{t("studioToneLabel")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {CAPTION_TONES.map((tone) => (
              <button
                key={tone.id}
                type="button"
                onClick={() => setCaptionTone(tone.id)}
                className={cn(
                  "rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors",
                  captionTone === tone.id
                    ? "border-violet-500 bg-violet-500/20 text-violet-200"
                    : "border-slate-700 text-slate-500 hover:border-slate-600"
                )}
              >
                {tone.labelFr}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-slate-400">Caption</Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleGenCaption}
                disabled={isGenCaption || isGenVariants || !params.influencerId}
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-40"
              >
                <Sparkles className="h-3 w-3" />
                {isGenCaption ? "Génération..." : "Générer"}
              </button>
              <button
                type="button"
                onClick={handleGenVariants}
                disabled={isGenVariants || isGenCaption || !params.influencerId}
                className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300 hover:bg-violet-500/20 disabled:opacity-40"
                title="Génère 2 variantes A/B et choisis la meilleure"
              >
                {isGenVariants ? "A/B…" : "A/B"}
              </button>
            </div>
          </div>
          {variants && variants.length > 0 && (
            <div className="space-y-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-violet-300">
                2 variantes — choisis la meilleure
              </p>
              {variants.map((v, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickVariant(v)}
                  className="block w-full rounded-md border border-slate-700/60 bg-slate-900/60 p-2.5 text-left text-xs text-slate-200 transition-colors hover:border-violet-500/60 hover:bg-slate-900"
                >
                  <span className="mb-1 block text-[10px] font-bold text-violet-400">
                    Variante {i === 0 ? "A" : "B"}
                  </span>
                  {v}
                </button>
              ))}
            </div>
          )}
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Écris ta caption ici..."
            rows={4}
            className="border-slate-800/50 bg-slate-800/30 text-sm text-white placeholder:text-slate-600"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600">
              {caption.length} caractères
            </span>
            <div className="flex gap-1.5">
              <Select value={language} onValueChange={(v) => setLanguage(v as "fr" | "en")}>
                <SelectTrigger className="h-6 w-14 border-slate-700 bg-slate-800/50 px-1.5 text-xs text-slate-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900">
                  <SelectItem value="fr" className="text-xs text-slate-300">🇫🇷 FR</SelectItem>
                  <SelectItem value="en" className="text-xs text-slate-300">🇬🇧 EN</SelectItem>
                </SelectContent>
              </Select>
              <Select value={captionPlatform} onValueChange={setCaptionPlatform}>
                <SelectTrigger className="h-6 w-20 border-slate-700 bg-slate-800/50 px-1.5 text-xs text-slate-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900">
                  <SelectItem value="INSTAGRAM" className="text-xs text-slate-300">Instagram</SelectItem>
                  <SelectItem value="TIKTOK" className="text-xs text-slate-300">TikTok</SelectItem>
                  <SelectItem value="ONLYFANS" className="text-xs text-slate-300">OnlyFans</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Hashtags */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-slate-400">Hashtags</Label>
            <button
              type="button"
              onClick={handleGenHashtags}
              disabled={isGenHashtags || !selectedInf}
              className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-40"
            >
              <Sparkles className="h-3 w-3" />
              {isGenHashtags ? "Génération..." : "Générer"}
            </button>
          </div>
          {/* Tags display */}
          <div className="flex flex-wrap gap-1">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-0.5 text-xs text-violet-400"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeHashtag(tag)}
                  className="hover:text-red-400"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <Input
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHashtag())}
              placeholder="#hashtag"
              className="h-7 border-slate-800/50 bg-slate-800/30 text-xs text-white placeholder:text-slate-600"
            />
          </div>
          <p className="text-xs text-slate-600">{hashtags.length}/30 hashtags</p>
        </div>

        {/* Platforms */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Plateformes</Label>
          <div className="space-y-1.5">
            <PlatformCard
              icon={<InstagramIcon className="h-4 w-4 text-pink-400" />}
              name="Instagram"
              selected={platforms.includes("INSTAGRAM")}
              onToggle={() => togglePlatform("INSTAGRAM")}
            />
            <PlatformCard
              icon={<TikTokIcon className="h-4 w-4 text-white" />}
              name="TikTok"
              selected={platforms.includes("TIKTOK")}
              onToggle={() => togglePlatform("TIKTOK")}
            />
            <PlatformCard
              icon={<OnlyFansIcon className="h-4 w-4 text-blue-400" />}
              name="OnlyFans"
              selected={platforms.includes("ONLYFANS")}
              onToggle={() => togglePlatform("ONLYFANS")}
              note="Export ZIP — publication manuelle"
            />
          </div>

          {/* OnlyFans honesty banner — surfaced as soon as OF is checked so
              the user never thinks the bot will post for them. */}
          {platforms.includes("ONLYFANS") && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5 text-[11px] text-blue-200">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
              <p className="leading-snug">
                OnlyFans n&apos;a pas d&apos;API publique. Nous générons un ZIP
                avec vos médias et un guide ; vous publierez manuellement sur
                votre compte OF.
              </p>
            </div>
          )}

          {instagramSelected && params.influencerId && (
            <div className="flex items-start gap-2 rounded-lg border border-pink-500/25 bg-pink-500/5 p-2.5 text-[11px] text-pink-100/90">
              <Instagram className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-400" />
              <div className="space-y-1.5">
                <p className="leading-snug">{t("publishInstagramApiHint")}</p>
                {instagramCheck && !instagramCheck.ok && (
                  <Link
                    href={`/influencers/${params.influencerId}?tab=social`}
                    className="inline-flex font-medium text-pink-300 underline-offset-2 hover:underline"
                  >
                    {t("publishConnectInstagram")}
                  </Link>
                )}
              </div>
            </div>
          )}

          {publishReminders.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-slate-700/60 bg-slate-800/30 p-2.5">
              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                <Info className="h-3.5 w-3.5" />
                {t("publishSoftRemindersTitle")}
              </div>
              <ul className="list-inside list-disc space-y-0.5 text-[11px] text-slate-500">
                {publishReminders.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="space-y-2">
          <Label className="text-xs text-slate-400">Programmation</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setScheduleMode("now")}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                scheduleMode === "now"
                  ? "border-violet-500 bg-violet-500/20 text-violet-300"
                  : "border-slate-700 bg-slate-800/30 text-slate-400"
              )}
            >
              Maintenant
            </button>
            <button
              type="button"
              onClick={() => setScheduleMode("schedule")}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                scheduleMode === "schedule"
                  ? "border-violet-500 bg-violet-500/20 text-violet-300"
                  : "border-slate-700 bg-slate-800/30 text-slate-400"
              )}
            >
              <Calendar className="mr-1 inline h-3 w-3" />
              Programmer
            </button>
          </div>
          {scheduleMode === "schedule" && (
            <div className="space-y-2">
              {slotsQuery.data?.[0] && (
                <p className="text-[10px] text-violet-400/90">
                  {t("publishSlotSuggested", {
                    time: toTimeInputValue(new Date(slotsQuery.data[0].at)),
                  })}
                </p>
              )}
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="h-8 flex-1 border-slate-700 bg-slate-800/50 text-xs text-white"
                />
                <Input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="h-8 w-24 border-slate-700 bg-slate-800/50 text-xs text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={!contentId || updateMutation.isPending}
            className="w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-40"
          >
            Sauvegarder en brouillon
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={
              !contentId || updateMutation.isPending || platforms.length === 0
            }
            className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {scheduleMode === "schedule" ? "Programmer" : "Publier"}
          </button>
          {platforms.includes("ONLYFANS") && (
            <button
              type="button"
              onClick={handleOFBundle}
              disabled={!contentId || bundleMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500/20 py-2.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30 disabled:opacity-40"
            >
              <Package className="h-4 w-4" />
              {bundleMutation.isPending ? "Préparation..." : "Télécharger le pack OF"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PlatformCard({
  icon,
  name,
  selected,
  onToggle,
  note,
}: {
  icon: React.ReactNode;
  name: string;
  selected: boolean;
  onToggle: () => void;
  note?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all",
        selected
          ? "border-violet-500/50 bg-violet-500/10"
          : "border-slate-800/50 bg-slate-800/20 hover:border-slate-700"
      )}
    >
      {icon}
      <div className="flex-1">
        <span className={cn("text-xs font-medium", selected ? "text-white" : "text-slate-400")}>
          {name}
        </span>
        {note && <p className="text-[9px] text-slate-600">{note}</p>}
      </div>
      <div
        className={cn(
          "h-4 w-4 rounded-md border-2 transition-all",
          selected
            ? "border-violet-500 bg-violet-500"
            : "border-slate-600 bg-transparent"
        )}
      >
        {selected && (
          <svg viewBox="0 0 16 16" className="h-full w-full text-white">
            <path
              fill="currentColor"
              d="M6.5 12.5l-4-4 1.5-1.5L6.5 9.5l6-6L14 5z"
            />
          </svg>
        )}
      </div>
    </button>
  );
}

