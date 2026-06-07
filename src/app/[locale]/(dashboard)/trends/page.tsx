"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslations, useLocale } from "next-intl";
import {
  TrendingUp,
  Sparkles,
  Loader2,
  AlertCircle,
  Lock,
  ArrowDown,
  Plus,
  Filter,
  Search,
} from "lucide-react";
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
import { TrendAiPickWrapper } from "@/components/trends/trend-ai-pick-wrapper";
import { Input } from "@/components/ui/input";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { useReelCreator } from "@/hooks/use-reel-creator";

type PlatformFilter = "ALL" | "TIKTOK" | "INSTAGRAM";
type SortMode = "growth" | "fresh";

// Niches the curated/Apify providers tag trends with. Matches the Niche enum
// in the Prisma schema + the cross-niche "GENERAL" catch-all the service
// uses when a trend doesn't fit any single niche.
const NICHE_OPTIONS = [
  "ALL",
  "FASHION",
  "FITNESS",
  "LIFESTYLE",
  "TRAVEL",
  "FOOD",
  "TECH",
  "GAMING",
] as const;
type NicheFilter = (typeof NICHE_OPTIONS)[number];

export default function TrendsPage() {
  const t = useTranslations("trends");
  const locale = useLocale();
  const language = locale === "en" ? "en" : "fr";
  const router = useRouter();
  const applyPhotoSeed = usePhotoCreator((s) => s.applySeed);
  const updateReelParams = useReelCreator((s) => s.updateParams);
  const setReelCaption = useReelCreator((s) => s.setCaption);
  const setReelHashtags = useReelCreator((s) => s.setHashtags);

  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string>("");
  const [platform, setPlatform] = useState<PlatformFilter>("ALL");
  const [niche, setNiche] = useState<NicheFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("growth");
  // Local "show more" cursor — we accumulate items page by page rather than
  // relying on infinite-scroll, simpler UX for ~30-90 cards total.
  const [pageSize, setPageSize] = useState<number>(30);
  // Track which single card is being personalized so we can show a per-card
  // spinner instead of disabling the whole grid.
  const [personalizingTrendId, setPersonalizingTrendId] = useState<string | null>(null);
  const [analyzingFormatTrendId, setAnalyzingFormatTrendId] = useState<
    string | null
  >(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const config = trpc.trends.config.useQuery();
  const influencersQuery = trpc.influencer.getAll.useQuery({ limit: 50 });
  const influencers = useMemo(
    () => influencersQuery.data?.influencers ?? [],
    [influencersQuery.data]
  );

  // Default to the first influencer once the list loads.
  useEffect(() => {
    if (!selectedInfluencerId && influencers.length > 0) {
      setSelectedInfluencerId(influencers[0]!.id);
    }
  }, [selectedInfluencerId, influencers]);

  const planMaxFeed = config.data?.planMaxFeed ?? 50;
  const feedLimit = Math.min(pageSize, planMaxFeed);

  const feed = trpc.trends.getFeed.useQuery(
    {
      influencerId: selectedInfluencerId,
      platform: platform === "ALL" ? undefined : platform,
      limit: feedLimit,
    },
    { enabled: Boolean(selectedInfluencerId) }
  );

  const globalFeed = trpc.trends.getGlobalFeed.useQuery(
    {
      influencerId: selectedInfluencerId,
      platform: platform === "ALL" ? undefined : platform,
      limit: feedLimit,
    },
    { enabled: Boolean(selectedInfluencerId) }
  );

  const analyzeQuery = trpc.agent.trends.analyze.useQuery(
    {
      influencerId: selectedInfluencerId,
      platform: platform === "ALL" ? undefined : platform,
      language,
      searchQuery: searchQuery || undefined,
    },
    {
      enabled: Boolean(selectedInfluencerId),
      staleTime: 5 * 60 * 1000,
    }
  );

  const utils = trpc.useUtils();

  const refreshMut = trpc.trends.refreshForInfluencer.useMutation({
    onSuccess: (r) => {
      toast.success(
        t("refreshSuccess", { count: r.created, cost: r.cost.toString() })
      );
      utils.trends.getFeed.invalidate();
      utils.trends.getGlobalFeed.invalidate();
      utils.billing.getCurrentPlan.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const personalizeOneMut = trpc.trends.personalizeOne.useMutation({
    onSuccess: (_r, vars) => {
      toast.success(t("personalizeOneSuccess"));
      utils.trends.getFeed.invalidate();
      utils.trends.getGlobalFeed.invalidate();
      utils.billing.getCurrentPlan.invalidate();
      setPersonalizingTrendId(null);
      void vars;
    },
    onError: (e) => {
      toast.error(e.message);
      setPersonalizingTrendId(null);
    },
  });

  const triggerInitialMut = trpc.trends.triggerInitialFetch.useMutation({
    onSuccess: (r) => {
      if (r.itemsCreated > 0) {
        toast.success(
          t("initialFetchSuccess", { count: r.itemsCreated.toString() })
        );
      } else {
        toast.info(t("initialFetchSkipped"));
      }
      utils.trends.getFeed.invalidate();
      utils.trends.getGlobalFeed.invalidate();
      void utils.agent.trends.analyze.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const dismissMut = trpc.trends.dismiss.useMutation({
    onSuccess: () => {
      utils.trends.getFeed.invalidate();
      utils.trends.getGlobalFeed.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const applyDestinationRef = useRef<"creator" | "calendar">("creator");

  const applyMut = trpc.trends.applyToPhotoParams.useMutation({
    onSuccess: (blob) => {
      if (blob.target === "reel") {
        updateReelParams({
          influencerId: blob.influencerId,
          duration: blob.duration,
          format: blob.format,
          videoType: blob.videoType,
          script: blob.script,
          sceneDescription: blob.sceneDescription ?? "",
          outfit: blob.outfit ?? "",
          music: blob.music,
          effects: blob.effects,
          textOverlay: blob.textOverlay,
          generateSceneFrame: true,
        });
        setReelCaption(blob.hook);
        setReelHashtags(blob.hashtags);
      } else {
        applyPhotoSeed({
          influencerId: blob.influencerId,
          lookId: blob.lookId,
          instagramShot: blob.instagramShot,
          scene: blob.scene,
          sceneDescription: blob.sceneDescription,
          pose: blob.pose,
          outfit: blob.outfit,
          expression: blob.expression,
          customPrompt: blob.customPrompt,
          caption: blob.hook,
          hashtags: blob.hashtags,
          sceneFirst: false,
          useFaceReference: true,
        });
      }
      if (applyDestinationRef.current === "calendar") {
        router.push(
          `/calendar?influencer=${blob.influencerId}&schedule=1&fromTrend=1`
        );
        toast.success(t("scheduleFromTrendSuccess"));
        return;
      }
      if (blob.target === "reel") {
        router.push(`/content/reel?influencer=${blob.influencerId}`);
      } else {
        router.push(`/content/photo?influencer=${blob.influencerId}`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const formatAnalyzeCost = config.data?.formatAnalyzeCost ?? 0.2;

  const analyzeFormatMut = trpc.trends.analyzeFormat.useMutation({
    onSettled: () => setAnalyzingFormatTrendId(null),
    onSuccess: () => {
      toast.success(t("formatAnalyzeSuccess"));
      utils.trends.getFeed.invalidate();
      utils.trends.getGlobalFeed.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const onAnalyzeFormat = (trendItemId: string) => {
    setAnalyzingFormatTrendId(trendItemId);
    analyzeFormatMut.mutate({ trendItemId });
  };

  const onApply = (recommendationId: string) => {
    if (!selectedInfluencerId) return;
    applyDestinationRef.current = "creator";
    applyMut.mutate({ influencerId: selectedInfluencerId, recommendationId });
  };
  const onSchedule = (recommendationId: string) => {
    if (!selectedInfluencerId) return;
    applyDestinationRef.current = "calendar";
    applyMut.mutate({ influencerId: selectedInfluencerId, recommendationId });
  };
  const onDismiss = (recommendationId: string) => {
    dismissMut.mutate({ recommendationId });
  };
  const onPersonalizeOne = (trendItemId: string) => {
    if (!selectedInfluencerId) return;
    setPersonalizingTrendId(trendItemId);
    personalizeOneMut.mutate({
      influencerId: selectedInfluencerId,
      trendItemId,
    });
  };

  // Personalized feed (niche-filtered) — used for AI analysis input
  const allItems = feed.data?.items ?? [];
  const globalAllItems = globalFeed.data?.items ?? [];

  const aiPicks = useMemo(() => {
    const picks = analyzeQuery.data?.picks ?? [];
    const byId = new Map(allItems.map((item) => [item.id, item]));
    return picks
      .map((pick) => {
        const trend = byId.get(pick.trendId);
        if (!trend) return null;
        return { trend, pick };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [analyzeQuery.data?.picks, allItems]);

  const pickIds = useMemo(() => new Set(aiPicks.map((p) => p.trend.id)), [aiPicks]);

  const filteredGlobalItems = useMemo(() => {
    let list = globalAllItems.filter((item) => !pickIds.has(item.id));
    if (niche !== "ALL") {
      list = list.filter(
        (item) =>
          item.nicheTags.includes(niche) || item.nicheTags.includes("GENERAL")
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q) ?? false) ||
          item.hashtags.some((tag) => tag.toLowerCase().includes(q)) ||
          item.nicheTags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    if (sortMode === "fresh") {
      list = [...list].sort((a, b) => {
        const ta = new Date(a.fetchedAt).getTime();
        const tb = new Date(b.fetchedAt).getTime();
        return tb - ta;
      });
    }
    return list;
  }, [globalAllItems, pickIds, niche, sortMode, searchQuery]);

  const planLocked = feed.data?.feature.planLocked ?? false;
  const planName = feed.data?.feature.planName ?? "Free";
  const providerConfigured = config.data?.providerConfigured ?? true;
  const analysisCost = config.data?.analysisCost ?? 0.5;
  const analysisOneCost = config.data?.analysisOneCost ?? 0.1;
  const recsMissingCount = filteredGlobalItems.filter((i) => !i.recommendation).length;

  const onAdaptTrend = async (
    trendItemId: string,
    recommendationId: string | null
  ) => {
    if (!selectedInfluencerId) return;
    applyDestinationRef.current = "creator";

    if (recommendationId) {
      applyMut.mutate({ influencerId: selectedInfluencerId, recommendationId });
      return;
    }

    if (planLocked) {
      toast.error(t("planLockedHint"));
      return;
    }

    setPersonalizingTrendId(trendItemId);
    try {
      const result = await personalizeOneMut.mutateAsync({
        influencerId: selectedInfluencerId,
        trendItemId,
      });
      applyMut.mutate({
        influencerId: selectedInfluencerId,
        recommendationId: result.recommendationId,
      });
    } catch {
      // toast handled by mutation
    } finally {
      setPersonalizingTrendId(null);
    }
  };

  const trendCardCommon = {
    needsPersonalization: !planLocked,
    onApply,
    onSchedule: planLocked ? undefined : onSchedule,
    onDismiss,
    onPersonalize: onPersonalizeOne,
    isBusy: applyMut.isPending || dismissMut.isPending,
    personalizeOneCost: analysisOneCost,
    onAnalyzeFormat,
    formatAnalyzeCost,
  };

  const isPageLoading = feed.isLoading || globalFeed.isLoading;

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

        <div className="flex flex-wrap items-center gap-2">
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
              allItems.length === 0
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

      {/* Configuration banner — only shown when EVERY provider (incl. curated)
          is unavailable. With the curated fallback this should ~never trigger
          in production, but we keep the UX so admins notice misconfig. */}
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

      {/* Filter bar — platform tabs + niche + sort */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Filter className="h-3.5 w-3.5" />
          <Select value={niche} onValueChange={(v) => setNiche(v as NicheFilter)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NICHE_OPTIONS.map((n) => (
                <SelectItem key={n} value={n} className="text-xs">
                  {n === "ALL" ? t("nicheAll") : t(`niches.${n}` as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="growth" className="text-xs">{t("sortGrowth")}</SelectItem>
              <SelectItem value="fresh" className="text-xs">{t("sortFresh")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* AI analysis banner */}
      {selectedInfluencerId && (
        <div className="rounded-xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-pink-500/5 to-transparent p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/20">
              {analyzeQuery.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-rose-300" />
              ) : (
                <Sparkles className="h-4 w-4 text-rose-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-rose-100">{t("aiAnalysisBanner")}</p>
              <p className="text-sm text-rose-200/70">
                {analyzeQuery.isLoading
                  ? t("aiAnalysisLoading")
                  : aiPicks.length > 0
                    ? t("aiAnalysisReady", { count: aiPicks.length })
                    : t("aiAnalysisEmpty")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Feed */}
      {isPageLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : allItems.length === 0 && globalAllItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
          <TrendingUp className="mx-auto mb-3 h-8 w-8 text-slate-600" />
          <p className="text-slate-300 font-medium">
            {allItems.length === 0 ? t("emptyFeed") : t("emptyFiltered")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {allItems.length === 0 ? t("emptyFeedHint") : t("emptyFilteredHint")}
          </p>
          {allItems.length === 0 && (
            <Button
              size="sm"
              className="mt-4 bg-emerald-500 hover:bg-emerald-600"
              disabled={triggerInitialMut.isPending}
              onClick={() => triggerInitialMut.mutate({ force: false })}
            >
              {triggerInitialMut.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-3.5 w-3.5" />
              )}
              {t("triggerInitialCta")}
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Section 1 — Pour toi */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{t("sectionForYou")}</h2>
              <p className="text-sm text-slate-400">{t("sectionForYouSubtitle")}</p>
            </div>

            {analyzeQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={`ai-${i}`} className="h-72 w-full rounded-2xl" />
                ))}
              </div>
            ) : aiPicks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-rose-500/20 bg-rose-500/5 p-6 text-center text-sm text-rose-200/70">
                {t("aiAnalysisEmpty")}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {aiPicks.map(({ trend, pick }) => (
                  <div key={trend.id} className="space-y-2">
                    {!trend.recommendation && !planLocked ? (
                      <Button
                        className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700"
                        disabled={
                          applyMut.isPending ||
                          personalizeOneMut.isPending ||
                          personalizingTrendId === trend.id
                        }
                        onClick={() =>
                          void onAdaptTrend(trend.id, trend.recommendation?.id ?? null)
                        }
                      >
                        {personalizingTrendId === trend.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {t("adaptTrendCta")}
                      </Button>
                    ) : null}
                    <TrendAiPickWrapper
                      whyItWorks={pick.whyItWorks}
                      suggestedAngle={pick.suggestedAngle}
                      confidence={pick.confidence}
                      trendCardProps={{
                        trend,
                        ...trendCardCommon,
                        isPersonalizing: personalizingTrendId === trend.id,
                        isAnalyzingFormat: analyzingFormatTrendId === trend.id,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
          </div>

          {/* Section 2 — En ce moment */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{t("sectionTrendingNow")}</h2>
              <p className="text-sm text-slate-400">{t("sectionTrendingNowSubtitle")}</p>
            </div>

            {recsMissingCount > 0 && !planLocked && (
              <p className="text-sm text-slate-400">
                {t("recsMissingV2", {
                  count: recsMissingCount,
                  cost: analysisOneCost.toString(),
                })}
              </p>
            )}

            {filteredGlobalItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center text-sm text-slate-400">
                {t("emptyFiltered")}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredGlobalItems.map((trend) => (
                  <TrendCard
                    key={trend.id}
                    trend={trend}
                    {...trendCardCommon}
                    isPersonalizing={personalizingTrendId === trend.id}
                    isAnalyzingFormat={analyzingFormatTrendId === trend.id}
                  />
                ))}
              </div>
            )}

            {globalAllItems.length >= feedLimit && feedLimit < planMaxFeed && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPageSize((s) => Math.min(s + 30, planMaxFeed))
                  }
                  disabled={globalFeed.isFetching}
                >
                  {globalFeed.isFetching ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-3.5 w-3.5" />
                  )}
                  {t("loadMore")}
                </Button>
              </div>
            )}
            {feedLimit >= planMaxFeed && globalAllItems.length > 0 && (
              <p className="flex items-center justify-center gap-1 pt-2 text-xs text-slate-500">
                <ArrowDown className="h-3 w-3" />
                {t("endOfFeed")}
              </p>
            )}
          </section>

          {/* Optional vibe search */}
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchQuery(searchDraft.trim());
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder={t("searchTrendPlaceholder")}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline">
              {t("searchTrendSubmit")}
            </Button>
          </form>
        </>
      )}
    </motion.div>
  );
}
