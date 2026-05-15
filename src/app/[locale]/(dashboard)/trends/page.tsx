"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { TrendingUp, Sparkles, Loader2, AlertCircle, Lock } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendCard } from "@/components/trends/trend-card";
import { usePhotoCreator } from "@/hooks/use-photo-creator";

type PlatformFilter = "ALL" | "TIKTOK" | "INSTAGRAM";

export default function TrendsPage() {
  const t = useTranslations("trends");
  const router = useRouter();
  const applySeed = usePhotoCreator((s) => s.applySeed);

  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string>("");
  const [platform, setPlatform] = useState<PlatformFilter>("ALL");

  const config = trpc.trends.config.useQuery();
  const influencersQuery = trpc.influencer.getAll.useQuery({ limit: 50 });
  const influencers = useMemo(
    () => influencersQuery.data?.influencers ?? [],
    [influencersQuery.data]
  );

  // Default to the first influencer once the list loads.
  if (!selectedInfluencerId && influencers.length > 0) {
    setSelectedInfluencerId(influencers[0]!.id);
  }

  const feed = trpc.trends.getFeed.useQuery(
    {
      influencerId: selectedInfluencerId,
      platform: platform === "ALL" ? undefined : platform,
      limit: 30,
    },
    { enabled: Boolean(selectedInfluencerId) }
  );

  const utils = trpc.useUtils();

  const refreshMut = trpc.trends.refreshForInfluencer.useMutation({
    onSuccess: (r) => {
      toast.success(
        t("refreshSuccess", { count: r.created, cost: r.cost.toString() })
      );
      utils.trends.getFeed.invalidate();
      utils.billing.getCurrentPlan.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const dismissMut = trpc.trends.dismiss.useMutation({
    onSuccess: () => utils.trends.getFeed.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const applyMut = trpc.trends.applyToPhotoParams.useMutation({
    onSuccess: (blob) => {
      // Prime the photo creator and navigate.
      applySeed({
        influencerId: blob.influencerId,
        scene: blob.scene,
        pose: blob.pose,
        outfit: blob.outfit,
        expression: blob.expression,
        customPrompt: blob.customPrompt,
        caption: blob.hook,
        hashtags: blob.hashtags,
      });
      const target = blob.type === "REEL" ? "/content/reel" : "/content/photo";
      router.push(target);
    },
    onError: (e) => toast.error(e.message),
  });

  const onApply = (recommendationId: string) => {
    if (!selectedInfluencerId) return;
    applyMut.mutate({ influencerId: selectedInfluencerId, recommendationId });
  };
  const onDismiss = (recommendationId: string) => {
    dismissMut.mutate({ recommendationId });
  };

  const items = feed.data?.items ?? [];
  const planLocked = feed.data?.feature.planLocked ?? false;
  const planName = feed.data?.feature.planName ?? "Free";
  const providerConfigured = config.data?.providerConfigured ?? true;
  const analysisCost = config.data?.analysisCost ?? 0.5;
  const recsMissingCount = items.filter((i) => !i.recommendation).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
            <Badge variant="outline" className="ml-1 border-emerald-500/40 text-emerald-300">
              {t("beta")}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">{t("subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={selectedInfluencerId}
            onValueChange={(v) => setSelectedInfluencerId(v)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={t("selectInfluencer")} />
            </SelectTrigger>
            <SelectContent>
              {influencers.map((inf) => (
                <SelectItem key={inf.id} value={inf.id}>
                  {inf.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() =>
              selectedInfluencerId &&
              refreshMut.mutate({
                influencerId: selectedInfluencerId,
                platform: platform === "ALL" ? undefined : platform,
              })
            }
            disabled={
              !selectedInfluencerId ||
              planLocked ||
              refreshMut.isPending ||
              items.length === 0
            }
            className="bg-violet-500 hover:bg-violet-600"
          >
            {refreshMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {t("personalizeCta", { cost: analysisCost.toString() })}
          </Button>
        </div>
      </header>

      {/* Configuration banner */}
      {!config.isLoading && !providerConfigured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">{t("notConfiguredTitle")}</p>
            <p className="text-amber-300/80">{t("notConfiguredHint")}</p>
          </div>
        </div>
      )}

      {/* Plan lock banner */}
      {planLocked && (
        <div className="flex items-start gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-sm text-violet-200">
          <Lock className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{t("planLockedTitle", { plan: planName })}</p>
            <p className="text-violet-300/80">{t("planLockedHint")}</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/billing">{t("upgradeCta")}</Link>
          </Button>
        </div>
      )}

      {/* Platform tabs */}
      <Tabs
        value={platform}
        onValueChange={(v) => setPlatform(v as PlatformFilter)}
      >
        <TabsList>
          <TabsTrigger value="ALL">{t("allPlatforms")}</TabsTrigger>
          <TabsTrigger value="TIKTOK">TikTok</TabsTrigger>
          <TabsTrigger value="INSTAGRAM">Instagram</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Feed */}
      {feed.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
          <TrendingUp className="mx-auto mb-3 h-8 w-8 text-slate-600" />
          <p className="text-slate-400">{t("emptyFeed")}</p>
          <p className="mt-1 text-xs text-slate-500">{t("emptyFeedHint")}</p>
        </div>
      ) : (
        <>
          {recsMissingCount > 0 && !planLocked && (
            <p className="text-sm text-slate-400">
              {t("recsMissing", { count: recsMissingCount })}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((trend) => (
              <TrendCard
                key={trend.id}
                trend={trend}
                needsPersonalization={!planLocked}
                onApply={onApply}
                onDismiss={onDismiss}
                isBusy={applyMut.isPending || dismissMut.isPending}
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
