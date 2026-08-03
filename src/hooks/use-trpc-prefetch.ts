"use client";

import { useCallback } from "react";
import { trpc } from "@/lib/trpc";

/** Prefetch common dashboard data on navigation hover. */
export function useTrpcPrefetch() {
  const utils = trpc.useUtils();

  const prefetchDashboard = useCallback(() => {
    void utils.billing.getCurrentPlan.prefetch();
    void utils.influencer.getAll.prefetch({ limit: 50 });
  }, [utils]);

  const prefetchContent = useCallback(() => {
    prefetchDashboard();
    void utils.content.getAll.prefetch({ limit: 20, page: 1 });
  }, [utils, prefetchDashboard]);

  const prefetchTrends = useCallback(() => {
    prefetchDashboard();
    void utils.trends.config.prefetch();
  }, [utils, prefetchDashboard]);

  return { prefetchDashboard, prefetchContent, prefetchTrends };
}
