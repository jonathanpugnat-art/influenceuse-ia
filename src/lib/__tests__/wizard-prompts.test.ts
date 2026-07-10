import { describe, expect, it } from "vitest";
import { agentTurnOutputSchema } from "@/lib/agent-core";
import { calendarAgentTurnToOutput } from "@/lib/calendar-agent";
import {
  getWizardLookProfile,
  getWizardContext,
} from "@/hooks/use-wizard-agent";
import type { WizardData } from "@/hooks/use-influencer-wizard";
import {
  validateWizardStep4Turn,
  validateWizardStep2Turn,
  validateWizardStep1Turn,
  wizardBioOptionsSchema,
} from "@/lib/prompts/wizard-prompts";

const sampleWizardData: WizardData = {
  name: "Luna",
  gender: "female",
  bio: "Bio test",
  personality: "Confiante",
  niche: "FITNESS",
  age: 26,
  isNsfw: false,
  ethnicity: "Latina",
  hairColor: "Brun",
  hairLength: "Long",
  hairTexture: "Ondulé",
  bodyType: "Athlétique",
  fashionStyles: ["Sporty"],
  skinTone: "Médium",
  height: "Moyenne",
  bustLevel: 0,
  hipsLevel: 0,
  shouldersLevel: 0,
  tattoos: [],
  makeupLevel: "Naturel",
  bodyGenerationMode: "standard",
  morphologyNotes: "",
  baseImageUrl: "https://cdn.example.com/face.jpg",
  appearanceVariations: {
    faceShape: 1,
    eyeShape: 2,
    eyeColor: 0,
    nose: 3,
    distinctiveFeature: 1,
    expression: 2,
  },
  appearanceFingerprint: "abc12345",
  instagramEnabled: true,
  instagramUsername: "@luna",
  tiktokEnabled: false,
  tiktokUsername: "",
  onlyfansEnabled: false,
  onlyfansUsername: "",
};

describe("use-wizard-agent helpers", () => {
  it("getWizardLookProfile returns only name, niche, personality, age", () => {
    const profile = getWizardLookProfile(sampleWizardData);
    expect(profile).toEqual({
      name: "Luna",
      niche: "FITNESS",
      personality: "Confiante",
      age: 26,
    });
    expect(Object.keys(profile).sort()).toEqual(
      ["age", "name", "niche", "personality"].sort()
    );
  });

  it("getWizardContext step 2 includes appearance v2 fields", () => {
    const step2 = getWizardContext(2, sampleWizardData);
    if (!("profile" in step2) || !("appearance" in step2)) {
      throw new Error("expected step 2 context");
    }
    expect(step2.profile).toEqual({
      name: "Luna",
      niche: "FITNESS",
      personality: "Confiante",
      age: 26,
      gender: "female",
    });
    expect(step2.appearance).toMatchObject({
      ethnicity: "Latina",
      bodyType: "Athlétique",
      skinTone: "Médium",
      height: "Moyenne",
      bustLevel: 0,
    });
  });

  it("getWizardContext step 1 and 4", () => {
    const step1 = getWizardContext(1, sampleWizardData);
    if (!("filledFields" in step1)) {
      throw new Error("expected step 1 context");
    }
    expect(step1).toEqual({
      filledFields: { name: "Luna", niche: "FITNESS", bio: "Bio test" },
    });

    const step4 = getWizardContext(4, sampleWizardData);
    if (!("profile" in step4) || !("currentBio" in step4)) {
      throw new Error("expected step 4 context");
    }
    expect(step4.profile).toEqual({
      name: "Luna",
      niche: "FITNESS",
      personality: "Confiante",
    });
    expect(step4.appearance).toEqual({
      ethnicity: "Latina",
      bodyType: "Athlétique",
      fashionStyles: ["Sporty"],
    });
    expect(step4.currentBio).toBe("Bio test");
  });
});

describe("wizard-prompts", () => {
  it("accepts 2 or 3 bioOptions from Haiku", () => {
    const two = validateWizardStep4Turn({
      message: "Choisis ta bio préférée.",
      bioOptions: [
        "Créatrice premium | Mode & lifestyle ✨",
        "Coucou, c'est moi — vraie, fun, sans filtre 💫",
      ],
    });
    expect(two.bioOptions).toHaveLength(2);

    const three = validateWizardStep4Turn({
      message: "Trois angles pour toi.",
      bioOptions: [
        "Premium edit",
        "Authentic voice",
        "Short punchy hook",
      ],
    });
    expect(three.bioOptions).toHaveLength(3);
  });

  it("rejects empty bioOptions array when field is present", () => {
    expect(() =>
      wizardBioOptionsSchema.parse([])
    ).toThrow();
  });

  it("rejects more than 3 bioOptions", () => {
    expect(() =>
      wizardBioOptionsSchema.parse(["a", "b", "c", "d"])
    ).toThrow();
  });

  it("validateWizardStep1Turn accepts personaVariants", () => {
    const parsed = validateWizardStep1Turn({
      message: "Voici 3 angles pour toi.",
      personaVariants: [
        { bio: "Bio authentique ✨", personality: "Chaleureuse et directe." },
        { bio: "Good vibes only 💫", personality: "Drôle et spontanée." },
        { bio: "Premium lifestyle", personality: "Ambitieuse et soignée." },
      ],
    });
    expect(parsed.personaVariants).toHaveLength(3);
  });

  it("validateWizardStep2Turn accepts look deltas", () => {
    const parsed = validateWizardStep2Turn({
      message: "Plus curvy.",
      look: { bodyType: "Curvy", bustLevel: 1 },
      quickReplies: ["Peau mate"],
    });
    expect(parsed.look?.bodyType).toBe("Curvy");
    expect(parsed.look?.bustLevel).toBe(1);
  });

  it("validateWizardStep1Turn coerces lowercase niche and string age from Haiku", () => {
    const parsed = validateWizardStep1Turn({
      message: "Parfait ! Créons ta fitness influenceuse.",
      suggestions: {
        gender: "female",
        niche: "fitness",
        age: "25",
        name: "Léa Fit",
      },
      quickReplies: ["Léa Fit", "Sofia Power"],
    });
    expect(parsed.suggestions?.niche).toBe("FITNESS");
    expect(parsed.suggestions?.age).toBe(25);
  });

  it("validateWizardStep2Turn clamps proportion levels from Haiku", () => {
    const parsed = validateWizardStep2Turn({
      message: "Plus généreux appliqué.",
      look: {
        bodyType: "Curvy",
        bustLevel: 2,
        hipsLevel: 3,
        shouldersLevel: 0,
      },
    });
    expect(parsed.look?.bustLevel).toBe(1);
    expect(parsed.look?.hipsLevel).toBe(1);
    expect(parsed.look?.shouldersLevel).toBe(0);
  });
});

describe("agentTurnOutputSchema cross-domain", () => {
  it("accepts calendar output without wizard fields", () => {
    const output = calendarAgentTurnToOutput(
      {
        params: {
          postsPerWeek: 3,
          startDate: "2026-05-01",
          endDate: "2026-05-31",
          vibe: null,
          goals: null,
          platforms: ["INSTAGRAM"],
          language: "fr",
        },
        missingFields: [],
        message: "Plan prêt !",
        readyToExecute: true,
      },
      {
        influencerId: "inf_1",
        days: 7,
        postsPerDay: 1,
        platforms: ["INSTAGRAM"],
        language: "fr",
      },
      "fr"
    );

    const parsed = agentTurnOutputSchema.parse(output);
    expect(parsed.wizardStep1Suggestions).toBeUndefined();
    expect(parsed.bioOptions).toBeUndefined();
    expect(parsed.readyToExecute).toBe(true);
  });

  it("accepts wizard step 4 output with 2 bioOptions", () => {
    const parsed = agentTurnOutputSchema.parse({
      message: "Deux bios pour toi.",
      bioOptions: ["Bio pro ✨", "Bio authentique 💫"],
    });
    expect(parsed.bioOptions).toHaveLength(2);
  });

  it("accepts wizard step 2 output with look adjustments", () => {
    const parsed = agentTurnOutputSchema.parse({
      message: "Look plus curvy.",
      wizardStep2Look: { bodyType: "Curvy", skinTone: "Mate" },
    });
    expect(parsed.wizardStep2Look?.bodyType).toBe("Curvy");
  });

  it("accepts placeholder trends/photo-style minimal output", () => {
    const parsed = agentTurnOutputSchema.parse({
      message: "Agent trends — bientôt disponible.",
      quickReplies: ["Top trends fitness"],
      readyToExecute: false,
    });
    expect(parsed.wizardStep1Suggestions).toBeUndefined();
  });
});
