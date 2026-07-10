"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { InfluencerCard, type InfluencerCardData } from "./influencer-card";
import { InfluencerTable } from "./influencer-table";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";

function getStoredView(): ViewMode {
  if (typeof window === "undefined") return "grid";
  return (localStorage.getItem("influencer-view") as ViewMode) ?? "grid";
}

function useNichesAndStatuses() {
  const t = useTranslations("influencer");
  return {
    niches: [
      { value: "ALL", label: t("allNiches") },
      { value: "FASHION", label: t("nicheFashion") },
      { value: "FITNESS", label: t("nicheFitness") },
      { value: "LIFESTYLE", label: t("nicheLifestyle") },
      { value: "TRAVEL", label: t("nicheTravel") },
      { value: "TECH", label: t("nicheTech") },
      { value: "GAMING", label: t("nicheGaming") },
      { value: "ADULT", label: t("nicheAdult") },
      { value: "FOOD", label: t("nicheFood") },
    ],
    statuses: [
      { value: "ALL", label: t("allStatuses") },
      { value: "ACTIVE", label: t("active") },
      { value: "PAUSED", label: t("paused") },
      { value: "ARCHIVED", label: t("archived") },
    ],
  };
}

export function InfluencerList() {
  const t = useTranslations("influencer");
  const tCommon = useTranslations("common");
  const { niches: NICHES, statuses: STATUSES } = useNichesAndStatuses();
  const [search, setSearch] = useState("");
  const [niche, setNiche] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>("grid");

  // Load view from localStorage on mount (client-only)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
    setView(getStoredView());
  }, []);

  const toggleView = (v: ViewMode) => {
    setView(v);
    localStorage.setItem("influencer-view", v);
  };

  const queryInput = {
    search: search || undefined,
    niche: niche !== "ALL" ? (niche as "FASHION") : undefined,
    status: status !== "ALL" ? (status as "ACTIVE") : undefined,
    page,
    limit: 12,
  };

  const { data, isLoading, error, isPlaceholderData } = trpc.influencer.getAll.useQuery(
    queryInput,
    { placeholderData: (prev) => prev }
  );

  const utils = trpc.useUtils();

  const statusMutation = trpc.influencer.updateStatus.useMutation({
    onSuccess: () => {
      utils.influencer.getAll.invalidate();
    },
  });

  const handleStatusChange = (id: string, newStatus: string) => {
    statusMutation.mutate({
      id,
      status: newStatus as "ACTIVE" | "PAUSED" | "ARCHIVED",
    });
  };

  const influencers: InfluencerCardData[] =
    data?.influencers?.map((i) => ({
      id: i.id,
      name: i.name,
      slug: i.slug,
      bio: i.bio,
      niche: i.niche,
      status: i.status,
      isNsfw: i.isNsfw,
      avatarUrl: i.avatarUrl,
      socialAccounts: i.socialAccounts.map((s) => ({
        platform: s.platform,
        followers: s.followers,
        isConnected: s.isConnected,
      })),
      analytics: i.analytics,
      _count: i._count,
    })) ?? [];

  // Reset page when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset page when filters change
    setPage(1);
  }, [search, niche, status]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? t("influencerCount", { count: data.total }) : tCommon("loading")}
          </p>
        </div>
        <Link href="/influencers/new" className="dash-cta">
          <Plus className="h-4 w-4" />
          {t("newInfluencerCta")}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tCommon("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 dash-filter pl-10 placeholder:text-muted-foreground focus:border-primary/50"
          />
        </div>

        <Select value={niche} onValueChange={setNiche}>
          <SelectTrigger className="h-10 w-full dash-filter sm:w-44 [&>span]:text-muted-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-border bg-popover">
            {NICHES.map((n) => (
              <SelectItem
                key={n.value}
                value={n.value}
                className="text-foreground focus:bg-accent"
              >
                {n.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-full dash-filter sm:w-40 [&>span]:text-muted-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-border bg-popover">
            {STATUSES.map((s) => (
              <SelectItem
                key={s.value}
                value={s.value}
                className="text-foreground focus:bg-accent"
              >
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex rounded-full border border-border/50 bg-card/60 p-1 backdrop-blur-sm">
          <button
            onClick={() => toggleView("grid")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
              view === "grid"
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleView("list")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
              view === "list"
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton view={view} />
      ) : error ? (
        <ErrorState />
      ) : influencers.length === 0 && !search && niche === "ALL" && status === "ALL" ? (
        <EmptyState />
      ) : influencers.length === 0 ? (
        <NoResultsState />
      ) : view === "grid" ? (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {influencers.map((inf) => (
              <InfluencerCard
                key={inf.id}
                influencer={inf}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        </AnimatePresence>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <InfluencerTable
            influencers={influencers}
            onStatusChange={handleStatusChange}
          />
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800/50 bg-slate-900/50 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-30"
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-slate-400">
            {t("pageOf", { page, total: data.totalPages })}
          </span>
          <button
            type="button"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800/50 bg-slate-900/50 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-30"
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton({ view }: { view: ViewMode }) {
  if (view === "list") {
    return (
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full bg-slate-800/50" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-5"
        >
          <div className="flex items-start gap-4">
            <Skeleton className="h-[72px] w-[72px] rounded-full bg-slate-800/50" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32 bg-slate-800/50" />
              <Skeleton className="h-4 w-20 bg-slate-800/50" />
            </div>
          </div>
          <Skeleton className="mt-3 h-10 w-full bg-slate-800/50" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-7 w-20 rounded-lg bg-slate-800/50" />
            <Skeleton className="h-7 w-20 rounded-lg bg-slate-800/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  const t = useTranslations("influencer");
  const tDashboard = useTranslations("dashboard");
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/50 bg-slate-900/50 py-20 backdrop-blur-xl"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800/50">
        <Users className="h-10 w-10 text-slate-600" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-white">
        {tDashboard("noInfluencers")}
      </h3>
      <p className="mt-2 max-w-sm text-center text-sm text-slate-400">
        {t("emptyDesc")}
      </p>
      <Link
        href="/influencers/new"
        className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        {tDashboard("createFirstCta")}
      </Link>
    </motion.div>
  );
}

function NoResultsState() {
  const t = useTranslations("influencer");
  const tCommon = useTranslations("common");
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/50 bg-slate-900/50 py-16 backdrop-blur-xl">
      <Search className="h-10 w-10 text-slate-600" />
      <h3 className="mt-4 text-base font-medium text-white">
        {tCommon("noResults")}
      </h3>
      <p className="mt-1 text-sm text-slate-400">
        {t("tryFilters")}
      </p>
    </div>
  );
}

function ErrorState() {
  const t = useTranslations("influencer");
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/5 py-16">
      <p className="text-sm text-red-400">
        {t("loadingError")}
      </p>
    </div>
  );
}

