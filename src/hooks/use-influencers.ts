"use client";

import type { TRPCClientErrorLike } from "@trpc/client";
import type { UseTRPCQueryResult } from "@trpc/react-query/shared";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "@/server/trpc/router";
import { trpcQueryDefaults } from "@/lib/trpc-query-defaults";

type InfluencersInput = inferRouterInputs<AppRouter>["influencer"]["getAll"];
type InfluencersOutput = inferRouterOutputs<AppRouter>["influencer"]["getAll"];

type InfluencersOptions = {
  enabled?: boolean;
  placeholderData?: (
    prev: InfluencersOutput | undefined
  ) => InfluencersOutput | undefined;
};

const defaultInput: InfluencersInput = { limit: 50 };

export function useInfluencers(
  input: InfluencersInput = defaultInput,
  options?: InfluencersOptions
): UseTRPCQueryResult<InfluencersOutput, TRPCClientErrorLike<AppRouter>> {
  return trpc.influencer.getAll.useQuery(input, {
    ...trpcQueryDefaults.influencers,
    ...options,
  });
}
