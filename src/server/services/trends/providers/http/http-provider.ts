import type { ProviderContext, RawTrendItem, TrendsProvider } from "../types";
import { normalizeLooseItem } from "./loose-normalize";

/**
 * Generic HTTP provider — for any backend that exposes a `RawTrendItem[]` feed
 * directly.
 */
export class GenericHttpProvider implements TrendsProvider {
  readonly id = "http";

  isConfigured(): boolean {
    return Boolean(process.env.TRENDS_HTTP_URL);
  }

  async fetchRawTrends(ctx?: ProviderContext): Promise<RawTrendItem[]> {
    if (!this.isConfigured()) {
      throw new Error("GenericHttpProvider is missing TRENDS_HTTP_URL");
    }
    const url = new URL(process.env.TRENDS_HTTP_URL!);
    if (ctx?.region) url.searchParams.set("region", ctx.region);
    if (ctx?.locale) url.searchParams.set("locale", ctx.locale);
    if (ctx?.limit) url.searchParams.set("limit", String(ctx.limit));

    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.TRENDS_HTTP_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.TRENDS_HTTP_TOKEN}`;
    }

    const res = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(
        `Trends HTTP feed returned ${res.status}: ${await res.text()}`
      );
    }
    const data = (await res.json()) as unknown;
    const items = Array.isArray(data)
      ? data
      : Array.isArray((data as { items?: unknown }).items)
        ? (data as { items: unknown[] }).items
        : [];
    return items
      .map((row) => normalizeLooseItem(row))
      .filter((row): row is RawTrendItem => row !== null);
  }
}
