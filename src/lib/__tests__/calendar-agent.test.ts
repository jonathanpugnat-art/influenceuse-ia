import { describe, expect, it } from "vitest";
import { endOfMonth, format, startOfMonth } from "date-fns";
import type { AgentTurnInput } from "@/lib/agent-core";
import {
  buildCalendarExecutionParams,
  buildFallbackCalendarTurn,
  calendarAgentTurnToOutput,
  countQuestions,
  detectMessageLocale,
} from "@/lib/calendar-agent";

const INFLUENCER_ID = "inf_test_123";

function userTurn(content: string): AgentTurnInput {
  return {
    domain: "calendar",
    messages: [{ role: "user", content }],
    context: {
      locale: detectMessageLocale(content),
      influencerId: INFLUENCER_ID,
    },
  };
}

describe("calendar-agent", () => {
  describe("natural language parsing (fallback)", () => {
    it("extracts postsPerWeek, vibe and fitness niche from French input", () => {
      const result = buildFallbackCalendarTurn(
        userTurn("3 posts par semaine ce mois, vibe été, niche fitness"),
        "fr"
      );

      expect(result.params.postsPerWeek).toBe(3);
      expect(result.params.vibe).toBe("été");
      expect(result.params.goals).toBe("fitness");
      expect(result.params.startDate).toBe(
        format(startOfMonth(new Date()), "yyyy-MM-dd")
      );
      expect(result.params.endDate).toBe(
        format(endOfMonth(new Date()), "yyyy-MM-dd")
      );
      expect(result.params.platforms).toEqual(["INSTAGRAM"]);
      expect(result.readyToExecute).toBe(true);
    });

    it("extracts English scheduling params", () => {
      const result = buildFallbackCalendarTurn(
        userTurn(
          "3 posts per week this month, summer vibe, fitness niche on Instagram"
        ),
        "en"
      );

      expect(result.params.postsPerWeek).toBe(3);
      expect(result.params.vibe).toBe("summer");
      expect(result.params.goals).toBe("fitness");
      expect(result.params.platforms).toEqual(["INSTAGRAM"]);
      expect(result.readyToExecute).toBe(true);
    });
  });

  describe("missing field detection", () => {
    it("returns readyToExecute false and exactly one clarifying question", () => {
      const result = buildFallbackCalendarTurn(
        userTurn("je veux poster ce mois"),
        "fr"
      );

      expect(result.readyToExecute).toBe(false);
      expect(result.missingFields).toContain("postsPerWeek");
      expect(countQuestions(result.message)).toBe(1);
      expect(result.message).toMatch(/posts par semaine/i);
    });
  });

  describe("ready state + executionParams", () => {
    it("populates executionParams when all params are present", () => {
      const parsed = buildFallbackCalendarTurn(
        userTurn(
          "3 posts par semaine ce mois, vibe été, niche fitness sur Instagram"
        ),
        "fr"
      );

      expect(parsed.readyToExecute).toBe(true);

      const executionParams = buildCalendarExecutionParams({
        params: parsed.params,
        influencerId: INFLUENCER_ID,
        locale: "fr",
      });

      expect(executionParams).not.toBeNull();
      expect(executionParams?.influencerId).toBe(INFLUENCER_ID);
      expect(executionParams?.platforms).toEqual(["INSTAGRAM"]);
      expect(executionParams?.days).toBeGreaterThan(0);
      expect(executionParams?.postsPerDay).toBeGreaterThan(0);
      expect(executionParams?.goals).toContain("fitness");
      expect(executionParams?.vibe).toBe("été");
      expect(executionParams?.startDate).toBeTruthy();

      const output = calendarAgentTurnToOutput(parsed, executionParams, "fr");
      expect(output.readyToExecute).toBe(true);
      expect(output.action).toBe("generate_content_plan");
      expect(output.executionParams).toEqual(executionParams);
      expect(output.message).toMatch(/Plan prêt/i);
    });
  });

  describe("language matching", () => {
    it("responds in French for French input", () => {
      const result = buildFallbackCalendarTurn(
        userTurn("je veux poster ce mois"),
        "en"
      );

      expect(detectMessageLocale("je veux poster ce mois")).toBe("fr");
      expect(result.message).toMatch(/Combien de posts par semaine/i);
      expect(result.params.language).toBe("fr");
    });

    it("responds in English for English input", () => {
      const result = buildFallbackCalendarTurn(
        userTurn("I want to post this month"),
        "fr"
      );

      expect(detectMessageLocale("I want to post this month")).toBe("en");
      expect(result.message).toMatch(/How many posts per week/i);
      expect(result.params.language).toBe("en");
    });
  });
});
