import { APIFY_RUN_TIMEOUT_MS } from "./constants";

export async function runApifyActor<T = unknown>(
  actorId: string,
  input: Record<string, unknown>,
  token: string
): Promise<T[]> {
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(
    actorId
  )}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&clean=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(APIFY_RUN_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Apify actor ${actorId} returned HTTP ${res.status}: ${body.slice(0, 400)}`
    );
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(`Apify actor ${actorId} did not return an array`);
  }
  return data as T[];
}
