"use client";

import type { TRPCClientErrorLike } from "@trpc/client";
import type { UseTRPCQueryResult } from "@trpc/react-query/shared";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "@/server/trpc/router";
import { trpcQueryDefaults } from "@/lib/trpc-query-defaults";

type PlanOutput = inferRouterOutputs<AppRouter>["billing"]["getCurrentPlan"];

type PlanQueryOptions = {
  enabled?: boolean;
  refetchOnMount?: boolean | "always";
};

export function useCurrentPlan(
  options?: PlanQueryOptions
): UseTRPCQueryResult<PlanOutput, TRPCClientErrorLike<AppRouter>> {
  return trpc.billing.getCurrentPlan.useQuery(undefined, {
    ...trpcQueryDefaults.plan,
    ...options,
  });
}

export function useInvalidateCurrentPlan() {
  const utils = trpc.useUtils();
  return () => void utils.billing.getCurrentPlan.invalidate();
}
