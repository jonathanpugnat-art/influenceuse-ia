import type { TrendsProvider } from "./types";
import { ApifyTrendsProvider } from "./apify/apify-provider";
import { CuratedTrendsProvider } from "./curated/curated-provider";
import { DevStubProvider } from "./dev-stub-provider";
import { GenericHttpProvider } from "./http/http-provider";

/**
 * Pick the right provider based on env.
 */
export function resolveTrendsProvider(): TrendsProvider | null {
  const choice = process.env.TRENDS_PROVIDER?.trim().toLowerCase();
  const apify = new ApifyTrendsProvider();
  const http = new GenericHttpProvider();
  const curated = new CuratedTrendsProvider();
  const stub = new DevStubProvider();

  if (choice === "apify") return apify.isConfigured() ? apify : null;
  if (choice === "http") return http.isConfigured() ? http : null;
  if (choice === "curated") return curated;
  if (choice === "stub") return stub.isConfigured() ? stub : null;

  if (apify.isConfigured()) return apify;
  if (http.isConfigured()) return http;
  if (curated.isConfigured()) return curated;
  if (stub.isConfigured()) return stub;
  return null;
}
