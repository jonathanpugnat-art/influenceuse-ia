"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Globe,
  X,
  Calendar,
  Clock,
  Package,
} from "lucide-react";
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
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function PhotoPublish() {
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
  const [isGenCaption, setIsGenCaption] = useState(false);
  const [isGenHashtags, setIsGenHashtags] = useState(false);

  const captionMutation = trpc.content.generateCaption.useMutation();
  const hashtagMutation = trpc.content.generateHashtags.useMutation();
  const updateMutation = trpc.content.updateContent.useMutation();
  const bundleMutation = trpc.content.prepareOnlyFansBundle.useMutation();

  const influencersQuery = trpc.influencer.getAll.useQuery({ limit: 50 });
  const selectedInf = influencersQuery.data?.influencers?.find(
    (i) => i.id === params.influencerId
  );

  // Generate caption
  const handleGenCaption = useCallback(async () => {
    if (!params.influencerId) return;
    setIsGenCaption(true);
    try {
      const result = await captionMutation.mutateAsync({
        influencerId: params.influencerId,
        contentDescription: `Photo: ${params.scene}, ${params.pose}, ${params.outfit || "casual"}`,
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
  }, [params, captionPlatform, language, captionMutation, setCaption]);

  // Generate hashtags
  const handleGenHashtags = useCallback(async () => {
    if (!selectedInf) return;
    setIsGenHashtags(true);
    try {
      const result = await hashtagMutation.mutateAsync({
        niche: selectedInf.niche,
        platform: captionPlatform as "INSTAGRAM",
        description: `Photo: ${params.scene}, ${params.pose}`,
        count: 15,
      });
      setHashtags(result.hashtags.map((h) => h.replace(/^#/, "")));
    } catch {
      toast.error("Erreur lors de la génération des hashtags");
    } finally {
      setIsGenHashtags(false);
    }
  }, [selectedInf, params, captionPlatform, hashtagMutation, setHashtags]);

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

  // Save / Publish
  const handleSave = async (publish: boolean) => {
    if (!contentId) return;
    try {
      await updateMutation.mutateAsync({
        contentId,
        caption: caption || undefined,
        hashtags: hashtags.length > 0 ? hashtags : undefined,
        platforms: platforms.length > 0 ? (platforms as ["INSTAGRAM"]) : undefined,
        status: publish
          ? scheduleMode === "schedule" && scheduledAt
            ? "SCHEDULED"
            : "PUBLISHED"
          : "DRAFT",
        scheduledAt: scheduleMode === "schedule" ? scheduledAt : undefined,
      });
      toast.success(
        publish
          ? scheduleMode === "schedule"
            ? "Contenu programmé !"
            : "Contenu publié !"
          : "Brouillon sauvegardé !"
      );
    } catch {
      toast.error("Erreur lors de la sauvegarde");
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
      className="h-full overflow-y-auto border-l border-slate-800/50 bg-slate-900/30 p-4 scrollbar-thin"
    >
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
        Publication
      </h2>

      <div className="space-y-5">
        {/* Caption */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-slate-400">Caption</Label>
            <button
              type="button"
              onClick={handleGenCaption}
              disabled={isGenCaption || !params.influencerId}
              className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-40"
            >
              <Sparkles className="h-3 w-3" />
              {isGenCaption ? "Génération..." : "Générer"}
            </button>
          </div>
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
              note="Préparer pour téléchargement"
            />
          </div>
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
            <div className="flex gap-2">
              <Input
                type="date"
                onChange={(e) => {
                  const d = e.target.value ? new Date(e.target.value) : null;
                  setScheduledAt(d);
                }}
                className="h-8 flex-1 border-slate-700 bg-slate-800/50 text-xs text-white"
              />
              <Input
                type="time"
                defaultValue="09:00"
                className="h-8 w-24 border-slate-700 bg-slate-800/50 text-xs text-white"
              />
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
            disabled={!contentId || updateMutation.isPending || platforms.length === 0}
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

