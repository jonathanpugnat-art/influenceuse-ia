"use client";

import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  TrendingUp,
  Sparkles,
  Loader2,
  AlertCircle,
  Lock,
  ArrowDown,
  Plus,
  Filter,
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
      limit: pageSize,
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

  const personalizeOneMut = trpc.trends.personalizeOne.useMutation({
    onSuccess: (_r, vars) => {
      toast.success(t("personalizeOneSuccess"));
      utils.trends.getFeed.invalidate();
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
    },
    onError: (e) => toast.error(e.message),
  });

  const dismissMut = trpc.trends.dismiss.useMutation({
    onSuccess: () => utils.trends.getFeed.invalidate(),
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

  // ── Apply local filters + sort ──────────────────────────────────────────
  // We do this client-side so the user can flip filters without re-fetching
  // (the entire feed for an influencer is already in memory and small).
  const allItems = feed.data?.items ?? [];
  const filteredItems = useMemo(() => {
    let list = allItems;
    if (niche !== "ALL") {
      // The trend's nicheTags array is normalized to upper-case enum keys
      // by `normalizeNicheTags()` in trends.service.ts. GENERAL trends
      // always pass any niche filter (they're cross-niche by design).
      list = list.filter(
        (item) =>
          item.nicheTags.includes(niche) || item.nicheTags.includes("GENERAL")
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
  }, [allItems, niche, sortMode]);

  const planLocked = feed.data?.feature.planLocked ?? false;
  const planName = feed.data?.feature.planName ?? "Free";
  const providerConfigured = config.data?.providerConfigured ?? true;
  const analysisCost = config.data?.analysisCost ?? 0.5;
  const analysisOneCost = config.data?.analysisOneCost ?? 0.1;
  const recsMissingCount = filteredItems.filter((i) => !i.recommendation).length;

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
              filteredItems.length === 0
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

      {/* Feed */}
      {feed.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
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
          {recsMissingCount > 0 && !planLocked && (
            <p className="text-sm text-slate-400">
              {t("recsMissingV2", {
                count: recsMissingCount,
                cost: analysisOneCost.toString(),
              })}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((trend) => (
              <TrendCard
                key={trend.id}
                trend={trend}
                needsPersonalization={!planLocked}
                onApply={onApply}
                onSchedule={planLocked ? undefined : onSchedule}
                onDismiss={onDismiss}
                onPersonalize={onPersonalizeOne}
                isBusy={applyMut.isPending || dismissMut.isPending}
                isPersonalizing={personalizingTrendId === trend.id}
                personalizeOneCost={analysisOneCost}
                onAnalyzeFormat={onAnalyzeFormat}
                isAnalyzingFormat={analyzingFormatTrendId === trend.id}
                formatAnalyzeCost={formatAnalyzeCost}
              />
            ))}
          </div>

          {/* Load more — only show when we got at least pageSize items
              (heuristic: there might be more in the cache). The router
              caps at planMaxFeed so this stops naturally. */}
          {allItems.length >= pageSize && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageSize((s) => s + 30)}
                disabled={feed.isFetching}
              >
                {feed.isFetching ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-3.5 w-3.5" />
                )}
                {t("loadMore")}
              </Button>
            </div>
          )}
          {allItems.length < pageSize && pageSize > 30 && (
            <p className="flex items-center justify-center gap-1 pt-2 text-xs text-slate-500">
              <ArrowDown className="h-3 w-3" />
              {t("endOfFeed")}
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}
