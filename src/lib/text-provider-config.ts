import type { AuraContentLane } from "@/lib/content-safety/aura-content-policy";

export type AgentTextBackend = "anthropic" | "deepseek" | "openrouter";

/**
 * Adult / NSFW / OF creative work → uncensored backend (never Claude).
 * SFW → Claude when configured, else DeepSeek.
 */
export function resolveAgentTextBackend(
  lane: AuraContentLane,
  env: Record<string, string | undefined> = process.env
): AgentTextBackend {
  if (lane === "adult") {
    const adult = env.ADULT_TEXT_PROVIDER?.trim().toLowerCase();
    if (adult === "openrouter" && env.OPENROUTER_API_KEY?.trim()) {
      return "openrouter";
    }
    if (adult === "anthropic") {
      console.warn(
        "[text-provider] ADULT_TEXT_PROVIDER=anthropic ignored — adult lane uses uncensored backend."
      );
    }
    return "deepseek";
  }

  const sfw = env.AI_AGENT_SFW_PROVIDER?.trim().toLowerCase();
  if (sfw === "deepseek") return "deepseek";
  if (env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  return "deepseek";
}

export function resolveAdultTextModel(
  env: Record<string, string | undefined> = process.env
): string {
  const backend = resolveAgentTextBackend("adult", env);
  if (backend === "openrouter") {
    return (
      env.ADULT_OPENROUTER_MODEL?.trim() ||
      "cognitivecomputations/dolphin-mistral-24b-venice-edition:free"
    );
  }
  return env.ADULT_DEEPSEEK_MODEL?.trim() || "deepseek-chat";
}

export function inferAdultLaneFromSignals(signals: {
  isNsfw?: boolean;
  niche?: string;
  contentMode?: string;
  brief?: string;
}): AuraContentLane {
  if (signals.isNsfw) return "adult";
  if (signals.contentMode === "NSFW") return "adult";
  if (signals.niche?.toUpperCase() === "ADULT") return "adult";
  const brief = signals.brief?.toLowerCase() ?? "";
  if (
    /\b(onlyfans|\bof\b|nsfw|adult content|contenu adulte|boudoir premium|monétisation explicite)\b/i.test(
      brief
    )
  ) {
    return "adult";
  }
  return "sfw";
}
