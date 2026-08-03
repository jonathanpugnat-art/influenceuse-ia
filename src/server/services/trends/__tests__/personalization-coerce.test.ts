import { describe, expect, it } from "vitest";
import { extractJsonPayload } from "@/lib/llm-json";
import { coerceLlmTrendRecommendations } from "@/server/services/trends/schemas";

describe("extractJsonPayload", () => {
  it("parses raw JSON arrays", () => {
    expect(extractJsonPayload('[{"a":1}]')).toEqual([{ a: 1 }]);
  });

  it("strips markdown fences and trailing commentary", () => {
    const text = `Here you go:\n\`\`\`json\n[{"hook":"hi"}]\n\`\`\`\nHope that helps!`;
    expect(extractJsonPayload(text)).toEqual([{ hook: "hi" }]);
  });
});

describe("coerceLlmTrendRecommendations", () => {
  it("clamps invalid enums and truncates long hooks", () => {
    const out = coerceLlmTrendRecommendations([
      {
        trendId: "t1",
        hook: "x".repeat(300),
        concept: "",
        type: "VIDEO",
        platform: "TWITTER",
        scene: "bathroom",
        pose: "handstand",
        expression: "angry",
        outfit: "gym leggings",
        customPrompt: "",
        confidence: "maybe",
        citations: [],
      },
    ]);

    expect(out).toHaveLength(1);
    expect(out[0]!.hook).toHaveLength(240);
    expect(out[0]!.concept).toBe(out[0]!.hook);
    expect(out[0]!.type).toBe("PHOTO");
    expect(out[0]!.platform).toBe("INSTAGRAM");
    expect(out[0]!.scene).toBe("studio");
    expect(out[0]!.pose).toBe("portrait");
    expect(out[0]!.expression).toBe("natural");
    expect(out[0]!.confidence).toBe("medium");
    expect(out[0]!.citations).toEqual(["llm"]);
  });

  it("unwraps { recommendations: [...] } envelopes", () => {
    const out = coerceLlmTrendRecommendations({
      recommendations: [
        {
          trendId: "t2",
          hook: "POV: first mile done",
          concept: "Running selfie",
          type: "REEL",
          platform: "TIKTOK",
          scene: "gym",
          pose: "selfie",
          expression: "smile",
          outfit: "athletic top",
          customPrompt: "natural light",
          confidence: "high",
          citations: ["trend.title"],
        },
      ],
    });
    expect(out[0]!.trendId).toBe("t2");
    expect(out[0]!.type).toBe("REEL");
  });
});
