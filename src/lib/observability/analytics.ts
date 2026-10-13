type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export type AnalyticsEvent =
  | { name: "face_preview_requested"; props?: AnalyticsProps }
  | { name: "face_preview_generated"; props: { durationMs: number } }
  | { name: "character_created"; props: { door: "builder" | "clone" } }
  | { name: "niche_saved"; props?: AnalyticsProps }
  | { name: "post_requested"; props: { sourceKind: string } }
  | {
      name: "post_generated";
      props: { durationMs: number; model: string; attempts: number };
    }
  | { name: "post_failed"; props: { errorCode: string } }
  | { name: "post_downloaded"; props?: AnalyticsProps }
  | { name: "video_requested"; props: { parentSourceKind: string } }
  | {
      name: "video_generated";
      props: { durationMs: number; model: string; attempts: number };
    }
  | { name: "video_failed"; props: { errorCode: string } }
  | { name: "checkout_started"; props: { kind: string; target: string } }
  | { name: "checkout_completed"; props?: AnalyticsProps }
  | { name: "credits_granted"; props: { reason: string; delta: number } }
  | { name: "credits_insufficient"; props: { balance: number; cost: number } }
  | { name: "upsell_clicked"; props?: AnalyticsProps }
  | {
      name: "identity_scored";
      props: { score: number; status: string; model: string; attempt: number };
    }
  | { name: "identity_auto_retry"; props: { previousStatus: string; score: number } }
  | { name: "post_regenerated"; props: { reason: string; previousStatus: string } }
  | { name: "lora_training_started"; props: { photoCount: number } }
  | { name: "lora_training_completed"; props: { enabled: boolean; score: number } };

function assertNever(value: never): never {
  throw new Error(`event inconnu: ${JSON.stringify(value)}`);
}

export function sanitizeProps(props: AnalyticsProps = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (key === "prompt" || key === "name" || key === "email") continue;
    if (typeof value === "string" && value.startsWith("data:")) continue;
    if (typeof value === "string" && value.includes("X-Amz-")) continue;
    out[key] = value;
  }
  return out;
}

export async function track(distinctId: string, event: AnalyticsEvent): Promise<void> {
  switch (event.name) {
    case "face_preview_requested":
    case "face_preview_generated":
    case "character_created":
    case "niche_saved":
    case "post_requested":
    case "post_generated":
    case "post_failed":
    case "post_downloaded":
    case "video_requested":
    case "video_generated":
    case "video_failed":
    case "checkout_started":
    case "checkout_completed":
    case "credits_granted":
    case "credits_insufficient":
    case "upsell_clicked":
    case "identity_scored":
    case "identity_auto_retry":
    case "post_regenerated":
    case "lora_training_started":
    case "lora_training_completed":
      break;
    default:
      assertNever(event);
  }

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  if (!key) return;

  try {
    const { PostHog } = await import("posthog-node");
    const client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
    client.capture({
      distinctId,
      event: event.name,
      properties: sanitizeProps(event.props),
    });
    await client.shutdown();
  } catch (error) {
    console.error("posthog track failed", error);
  }
}
