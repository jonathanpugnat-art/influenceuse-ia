"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { CREDIT_COSTS } from "@/lib/constants";

const PLATFORM_OPTIONS = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "ONLYFANS", label: "OnlyFans" },
] as const;

type PlatformValue = (typeof PLATFORM_OPTIONS)[number]["value"];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful plan generation so the calendar can refetch. */
  onCreated?: (batchId: string, postsCreated: number) => void;
}

export function ContentPlanDialog({ open, onClose, onCreated }: Props) {
  const t = useTranslations("calendar");

  const [influencerId, setInfluencerId] = useState<string>("");
  const [days, setDays] = useState<number>(7);
  const [postsPerDay, setPostsPerDay] = useState<number>(2);
  const [platforms, setPlatforms] = useState<PlatformValue[]>(["INSTAGRAM", "TIKTOK"]);
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [goals, setGoals] = useState<string>("");

  const { data: influencersData } = trpc.influencer.getAll.useQuery(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );
  const influencers = influencersData?.influencers ?? [];

  const utils = trpc.useUtils();
  const planMutation = trpc.content.generateContentPlan.useMutation({
    onSuccess: (res) => {
      toast.success(t("planSuccess", { count: res.postsCreated }));
      utils.publish.getCalendarEvents.invalidate();
      onCreated?.(res.batchId, res.postsCreated);
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || t("planError"));
    },
  });

  const togglePlatform = (p: PlatformValue) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const totalPosts = days * postsPerDay;
  const cost = +(CREDIT_COSTS.CONTENT_PLAN_PER_POST * totalPosts).toFixed(2);
  const canSubmit =
    !!influencerId && platforms.length > 0 && !planMutation.isPending;

  const submit = () => {
    if (!canSubmit) return;
    planMutation.mutate({
      influencerId,
      days,
      postsPerDay,
      platforms,
      language,
      goals: goals.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-slate-800 bg-slate-900 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            {t("planTitle")}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {t("planSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Influencer */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">{t("planInfluencer")}</Label>
            <Select value={influencerId} onValueChange={setInfluencerId}>
              <SelectTrigger className="border-slate-800/50 bg-slate-800/30 text-white">
                <SelectValue placeholder={t("planInfluencerPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="border-slate-800 bg-slate-900">
                {influencers.map((inf) => (
                  <SelectItem key={inf.id} value={inf.id} className="text-slate-300 focus:bg-slate-800 focus:text-white">
                    {inf.name} <span className="text-xs text-slate-500">{inf.niche}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Days × posts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">{t("planDays")}</Label>
              <Input
                type="number"
                min={1}
                max={14}
                value={days}
                onChange={(e) => setDays(Math.max(1, Math.min(14, Number(e.target.value) || 1)))}
                className="border-slate-800/50 bg-slate-800/30 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-400">{t("planPostsPerDay")}</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={postsPerDay}
                onChange={(e) => setPostsPerDay(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                className="border-slate-800/50 bg-slate-800/30 text-white"
              />
            </div>
          </div>

          {/* Platforms */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">{t("planPlatforms")}</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((p) => {
                const active = platforms.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePlatform(p.value)}
                    className={
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors " +
                      (active
                        ? "border-violet-500 bg-violet-500/20 text-violet-300"
                        : "border-slate-700 bg-slate-800/30 text-slate-400 hover:border-slate-600")
                    }
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">{t("planLanguage")}</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as "fr" | "en")}>
              <SelectTrigger className="border-slate-800/50 bg-slate-800/30 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-slate-800 bg-slate-900">
                <SelectItem value="fr" className="text-slate-300 focus:bg-slate-800 focus:text-white">
                  Français
                </SelectItem>
                <SelectItem value="en" className="text-slate-300 focus:bg-slate-800 focus:text-white">
                  English
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Goals */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">{t("planGoals")}</Label>
            <Textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder={t("planGoalsPlaceholder")}
              rows={2}
              className="border-slate-800/50 bg-slate-800/30 text-white placeholder:text-slate-600"
            />
          </div>

          <div className="rounded-lg border border-slate-800/50 bg-slate-800/30 p-3 text-xs text-slate-400">
            {t("planEstimate", { count: totalPosts, cost })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
            {t("planCancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:opacity-90"
          >
            {planMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("planSubmitting")}
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {t("planSubmit")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
