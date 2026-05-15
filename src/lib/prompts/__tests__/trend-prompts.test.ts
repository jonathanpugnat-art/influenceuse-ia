import { describe, expect, it } from "vitest";
import {
  buildTrendPersonalizationPrompt,
  TREND_SCENES,
  TREND_POSES,
  TREND_EXPRESSIONS,
} from "@/lib/prompts/trend-prompts";

describe("trend-prompts", () => {
  const baseInfluencer = {
    influencerName: "Luna",
    influencerGender: "female" as const,
    niche: "FITNESS",
    personality: "warm, sporty, honest",
    bio: "Daily training & lifestyle from Lisbon",
    isNsfw: false,
    language: "fr" as const,
  };
  const baseTrends = [
    {
      trendId: "t1",
      platform: "TIKTOK",
      title: "GRWM running",
      hashtags: ["grwm", "running"],
    },
  ];

  it("lists the allowed scene/pose/expression enums verbatim", () => {
    const { systemPrompt } = buildTrendPersonalizationPrompt(
      baseInfluencer,
      baseTrends
    );
    for (const s of TREND_SCENES) expect(systemPrompt).toContain(`"${s}"`);
    for (const p of TREND_POSES) expect(systemPrompt).toContain(`"${p}"`);
    for (const e of TREND_EXPRESSIONS) expect(systemPrompt).toContain(`"${e}"`);
  });

  it("forbids real people and external sounds when missing", () => {
    const { systemPrompt } = buildTrendPersonalizationPrompt(
      baseInfluencer,
      baseTrends
    );
    expect(systemPrompt).toMatch(/celebrities|public figures|real people/i);
    expect(systemPrompt).toMatch(/invent a song|invent or name|NEVER invent a song/i);
  });

  it("downgrades NSFW for SFW accounts", () => {
    const { systemPrompt } = buildTrendPersonalizationPrompt(
      baseInfluencer,
      baseTrends
    );
    expect(systemPrompt).toMatch(/SFW/);
    expect(systemPrompt).toMatch(/Downgrade/);
  });

  it("allows tasteful suggestive for NSFW accounts", () => {
    const { systemPrompt } = buildTrendPersonalizationPrompt(
      { ...baseInfluencer, isNsfw: true },
      baseTrends
    );
    expect(systemPrompt).toMatch(/tasteful suggestive/i);
    expect(systemPrompt).toMatch(/no minors/i);
  });

  it("embeds influencer profile and trend payload in the user prompt", () => {
    const { systemPrompt, userPrompt } = buildTrendPersonalizationPrompt(
      baseInfluencer,
      baseTrends
    );
    expect(systemPrompt).toContain("Luna");
    expect(systemPrompt).toContain("FITNESS");
    expect(systemPrompt).toContain("français");
    expect(userPrompt).toContain("GRWM running");
    expect(userPrompt).toContain('"trendId": "t1"');
  });
});
