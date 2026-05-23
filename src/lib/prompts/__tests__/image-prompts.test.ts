import { describe, it, expect } from "vitest";
import {
  buildFullPrompt,
  buildNegativePrompt,
  buildBasePortraitPrompt,
  pickAppearanceVariations,
  renderAppearanceVariations,
  explodeAppearanceVariations,
  appearanceFingerprint,
  APPEARANCE_VARIATIONS,
  NEGATIVE_PROMPT_SFW,
  NEGATIVE_PROMPT_NSFW,
} from "@/lib/prompts/image-prompts";

describe("image-prompts", () => {
  describe("buildFullPrompt", () => {
    it("generates a coherent prompt with all main parameters (female)", () => {
      const result = buildFullPrompt({
        gender: "female",
        age: 25,
        ethnicity: "Caucasian",
        hairColor: "blonde",
        hairStyle: "long",
        bodyType: "slim",
        fashionStyle: "casual",
        scene: "beach",
        pose: "fullBody",
        expression: "smile",
        style: "natural",
        lighting: "golden_hour",
        outfit: "summer dress",
        customPrompt: "wind in hair",
      });
      expect(result).toContain("25 years old");
      expect(result).toContain("caucasian");
      expect(result).toContain("blonde long hair");
      expect(result).toContain("slim build");
      expect(result).toContain("wearing summer dress");
      expect(result).toContain("real beach");
      expect(result).toContain("no mirror");
      expect(result).toContain("genuine big smile");
      expect(result).toContain("golden hour");
      expect(result).toContain("iPhone");
      expect(result).toContain("TikTok");
      expect(result).toContain("wind in hair");
    });

    it("front-loads outfit and brackets it with reinforcement (Sprint 11)", () => {
      const result = buildFullPrompt({
        gender: "female",
        outfit: "red leather jacket with white sneakers",
        scene: "urban",
        pose: "fullBody",
        expression: "natural",
        style: "fashion_campaign",
      });
      // Outfit must come before scene description in the prompt.
      const outfitPos = result.indexOf("red leather jacket");
      const scenePos = result.indexOf("real city sidewalk");
      expect(outfitPos).toBeGreaterThan(0);
      expect(scenePos).toBeGreaterThan(outfitPos);
      // We explicitly emphasize the outfit so the model doesn't drift.
      expect(result).toContain("outfit clearly visible");
      // The defanged style template must NOT contradict the outfit any more.
      expect(result).not.toMatch(/luxury menswear|well-dressed.*luxury|effortless feminine style/);
    });

    it("encodes 'NOT a studio shoot' negatives directly in the positive prompt (Sprint 11.1)", () => {
      const result = buildFullPrompt({
        gender: "female",
        scene: "cafe",
        expression: "natural",
        style: "natural",
      });
      // Flux Kontext Pro has no negative_prompt channel — we encode them inline.
      expect(result).toContain("real candid iPhone photo");
      expect(result).toContain("snapped by a friend on an iPhone");
      expect(result).toContain("iPhone flash");
      expect(result).toContain("NOT a studio photo");
      expect(result).toContain("NOT AI-perfect");
    });

    it("generates a masculine prompt for male gender", () => {
      const result = buildFullPrompt({
        gender: "male",
        age: 28,
        scene: "urban",
        pose: "fullBody",
        expression: "serious",
      });
      expect(result).toContain("a man");
      expect(result).toContain("masculine man");
      expect(result).toContain("NO feminine clothing");
      expect(result).toContain("leather backpack");
      // Sprint 11.1 — "editorial stare" replaced with a more candid neutral.
      expect(result).toContain("neutral expression");
    });

    it("includes location in prompt when provided", () => {
      const result = buildFullPrompt({
        gender: "female",
        location: "Eiffel Tower Paris",
      });
      expect(result).toContain("Eiffel Tower Paris");
      expect(result).toContain("famous landmark visible");
    });

    it("includes NSFW template only when isNsfw is true and nsfwLevel is set", () => {
      const sfw = buildFullPrompt({
        gender: "female",
        isNsfw: false,
        nsfwLevel: "suggestive",
        expression: "natural",
      });
      expect(sfw).not.toContain("lingerie");

      const nsfw = buildFullPrompt({
        gender: "female",
        isNsfw: true,
        nsfwLevel: "suggestive",
        expression: "natural",
      });
      expect(nsfw).toContain("lingerie");
    });

    it("does not add NSFW when isNsfw is true but nsfwLevel is unknown", () => {
      const result = buildFullPrompt({
        isNsfw: true,
        nsfwLevel: "unknown_key",
        expression: "natural",
      });
      expect(result).not.toContain("explicit");
      expect(result).toContain("iPhone");
    });

    it("uses fallback for unknown scene/pose/expression keys", () => {
      const result = buildFullPrompt({
        scene: "custom_scene",
        pose: "custom_pose",
        expression: "custom_expr",
      });
      expect(result).toContain("custom_scene");
      expect(result).toContain("custom_pose");
      expect(result).toContain("custom_expr");
    });

    it("prefers sceneDescription over preset SCENE_TEMPLATES", () => {
      const result = buildFullPrompt({
        gender: "female",
        scene: "urban",
        sceneDescription:
          "quiet hotel lobby, marble floor, soft ambient light, no street, no mirror",
        pose: "candid",
        expression: "natural",
      });
      expect(result).toContain(
        "setting and environment: quiet hotel lobby"
      );
      expect(result).not.toContain("real city sidewalk");
      expect(result).not.toContain("designer sunglasses");
    });

    it("includes identity lock when useReferenceFace is true", () => {
      const result = buildFullPrompt({
        gender: "female",
        useReferenceFace: true,
        expression: "natural",
      });
      expect(result).toContain("same exact person as the reference photo");
      expect(result).toContain("identical facial identity");
    });

    it("does not add identity lock when useReferenceFace is false", () => {
      const result = buildFullPrompt({
        gender: "female",
        useReferenceFace: false,
        expression: "natural",
      });
      expect(result).not.toContain("same exact person as the reference photo");
    });

    it("adds kontext harmonization block without forcing wide shot", () => {
      const nano = buildFullPrompt({ contentEngine: "nano", expression: "natural" });
      const kontext = buildFullPrompt({ contentEngine: "kontext", expression: "natural" });
      expect(kontext).toContain("medium shot from mid-torso up");
      expect(kontext).not.toContain("tiny figure in the distance");
      expect(nano).not.toContain("medium shot from mid-torso up");
    });

    it("always ends with quality and can append customPrompt", () => {
      const result = buildFullPrompt({
        customPrompt: "extra detail",
      });
      expect(result).toContain("iPhone");
      expect(result).toContain("TikTok");
      expect(result).toContain("extra detail");
    });
  });

  describe("buildNegativePrompt", () => {
    it("returns SFW negative prompt for female", () => {
      const result = buildNegativePrompt(false, "female");
      expect(result).toBe(NEGATIVE_PROMPT_SFW);
      expect(result).toContain("nsfw");
      expect(result).toContain("nude");
    });

    it("returns NSFW negative prompt when isNsfw is true", () => {
      const result = buildNegativePrompt(true, "female");
      expect(result).toBe(NEGATIVE_PROMPT_NSFW);
      expect(result).not.toContain("nsfw");
      expect(result).not.toContain("nude");
    });

    it("adds face-lock negative terms when lockFace is true", () => {
      const result = buildNegativePrompt(false, "female", { lockFace: true });
      expect(result).toContain(NEGATIVE_PROMPT_SFW);
      expect(result).toContain("face swap");
      expect(result).toContain("wrong face");
    });

    it("adds face-lock and masculine terms for male with lockFace", () => {
      const result = buildNegativePrompt(false, "male", { lockFace: true });
      expect(result).toContain("dress");
      expect(result).toContain("face swap");
    });

    it("adds masculine negative terms for male gender", () => {
      const result = buildNegativePrompt(false, "male");
      expect(result).toContain(NEGATIVE_PROMPT_SFW);
      expect(result).toContain("dress");
      expect(result).toContain("skirt");
      expect(result).toContain("lipstick");
      expect(result).toContain("feminine clothing");
    });
  });

  describe("buildBasePortraitPrompt", () => {
    it("replaces all placeholders with input values", () => {
      const result = buildBasePortraitPrompt({
        age: 28,
        ethnicity: "Asian",
        hairColor: "black",
        hairStyle: "straight",
        bodyType: "athletic",
        fashionStyle: "streetwear",
      });
      expect(result).toContain("28");
      expect(result).toContain("asian");
      expect(result).toContain("black");
      expect(result).toContain("straight");
      expect(result).toContain("athletic");
      expect(result).toContain("streetwear");
    });

    it("uses gender label in base portrait", () => {
      const female = buildBasePortraitPrompt({
        age: 25, ethnicity: "caucasian", hairColor: "brown",
        hairStyle: "long", bodyType: "slim", fashionStyle: "casual",
        gender: "female",
      });
      expect(female).toContain("woman");

      const male = buildBasePortraitPrompt({
        age: 30, ethnicity: "caucasian", hairColor: "black",
        hairStyle: "short", bodyType: "athletic", fashionStyle: "casual",
        gender: "male",
      });
      expect(male).toContain("man");
    });
  });

  describe("appearance variations (Sprint 13 uniqueness guard)", () => {
    it("pickAppearanceVariations returns valid indices into every pool", () => {
      // Drive 50 picks through Math.random to make sure every pool boundary
      // holds — protects against off-by-one in the picker.
      for (let i = 0; i < 50; i++) {
        const v = pickAppearanceVariations();
        expect(v.faceShape).toBeGreaterThanOrEqual(0);
        expect(v.faceShape).toBeLessThan(APPEARANCE_VARIATIONS.faceShape.length);
        expect(v.eyeShape).toBeLessThan(APPEARANCE_VARIATIONS.eyeShape.length);
        expect(v.eyeColor).toBeLessThan(APPEARANCE_VARIATIONS.eyeColor.length);
        expect(v.nose).toBeLessThan(APPEARANCE_VARIATIONS.nose.length);
        expect(v.distinctiveFeature).toBeLessThan(APPEARANCE_VARIATIONS.distinctiveFeature.length);
        expect(v.expression).toBeLessThan(APPEARANCE_VARIATIONS.expression.length);
      }
    });

    it("two prompts with identical style + age but no shared variations differ", () => {
      // This is THE invariant the whole Sprint 13 fix exists for.
      const style = {
        age: 25,
        ethnicity: "caucasian",
        hairColor: "brown",
        hairStyle: "long straight",
        bodyType: "average",
        fashionStyle: "casual",
        gender: "female" as const,
      };
      const promptA = buildBasePortraitPrompt({
        ...style,
        variations: { faceShape: 0, eyeShape: 0, eyeColor: 0, nose: 0, distinctiveFeature: 0, expression: 0 },
      });
      const promptB = buildBasePortraitPrompt({
        ...style,
        variations: { faceShape: 5, eyeShape: 5, eyeColor: 5, nose: 5, distinctiveFeature: 5, expression: 5 },
      });
      expect(promptA).not.toBe(promptB);
    });

    it("renderAppearanceVariations injects all 6 axes into the prompt", () => {
      const v = { faceShape: 0, eyeShape: 0, eyeColor: 2, nose: 1, distinctiveFeature: 3, expression: 4 };
      const rendered = renderAppearanceVariations(v);
      expect(rendered).toContain(APPEARANCE_VARIATIONS.faceShape[0]);
      expect(rendered).toContain(APPEARANCE_VARIATIONS.eyeColor[2]);
      expect(rendered).toContain(APPEARANCE_VARIATIONS.distinctiveFeature[3]);
      expect(rendered).toContain(APPEARANCE_VARIATIONS.expression[4]);
    });

    it("appearanceFingerprint is deterministic and 8 hex chars", () => {
      const v = { faceShape: 1, eyeShape: 2, eyeColor: 3, nose: 0, distinctiveFeature: 1, expression: 2 };
      const style = { gender: "female", ethnicity: "caucasian", hairColor: "brown", hairStyle: "long", bodyType: "slim", fashionStyle: "casual" };
      const fp1 = appearanceFingerprint(style, 25, v);
      const fp2 = appearanceFingerprint(style, 25, v);
      expect(fp1).toBe(fp2);
      expect(fp1).toMatch(/^[0-9a-f]{8}$/);
    });

    it("appearanceFingerprint differs when ANY visual axis changes", () => {
      const baseStyle = { gender: "female", ethnicity: "caucasian", hairColor: "brown", hairStyle: "long", bodyType: "slim", fashionStyle: "casual" };
      const baseV = { faceShape: 0, eyeShape: 0, eyeColor: 0, nose: 0, distinctiveFeature: 0, expression: 0 };
      const fpBase = appearanceFingerprint(baseStyle, 25, baseV);

      // Each of these tweaks must produce a different fingerprint, otherwise
      // the duplicate-detection index would mis-report siblings as identical.
      expect(appearanceFingerprint(baseStyle, 26, baseV)).not.toBe(fpBase);
      expect(appearanceFingerprint({ ...baseStyle, hairColor: "blonde" }, 25, baseV)).not.toBe(fpBase);
      expect(appearanceFingerprint(baseStyle, 25, { ...baseV, faceShape: 1 })).not.toBe(fpBase);
      expect(appearanceFingerprint(baseStyle, 25, { ...baseV, eyeColor: 1 })).not.toBe(fpBase);
      expect(appearanceFingerprint(baseStyle, 25, { ...baseV, expression: 1 })).not.toBe(fpBase);
    });

    // ── Sprint 14 — explodeAppearanceVariations + DNA in content prompt ──
    it("explodeAppearanceVariations returns each trait labelled separately", () => {
      const v = { faceShape: 0, eyeShape: 1, eyeColor: 2, nose: 0, distinctiveFeature: 3, expression: 4 };
      const out = explodeAppearanceVariations(v);
      expect(out.faceShape).toBe(APPEARANCE_VARIATIONS.faceShape[0]);
      expect(out.eyeShape).toBe(APPEARANCE_VARIATIONS.eyeShape[1]);
      expect(out.eyeColor).toBe(APPEARANCE_VARIATIONS.eyeColor[2]);
      expect(out.distinctiveFeature).toBe(APPEARANCE_VARIATIONS.distinctiveFeature[3]);
      expect(out.expression).toBe(APPEARANCE_VARIATIONS.expression[4]);
    });

    it("buildFullPrompt injects appearanceVariations as a facial details block", () => {
      // Without variations → no facial details block in the prompt.
      const without = buildFullPrompt({
        gender: "female",
        age: 25,
        ethnicity: "caucasian",
        hairColor: "brown",
        hairStyle: "long",
        bodyType: "slim",
        scene: "studio",
      });
      expect(without).not.toContain("facial details:");

      // With variations → the same render() string the wizard portrait
      // used appears in the content prompt as well. This is the key
      // assertion: it's what guarantees feed photos look like the same
      // person as the base portrait.
      const v = { faceShape: 0, eyeShape: 1, eyeColor: 2, nose: 0, distinctiveFeature: 0, expression: 0 };
      const withV = buildFullPrompt({
        gender: "female",
        age: 25,
        ethnicity: "caucasian",
        hairColor: "brown",
        hairStyle: "long",
        bodyType: "slim",
        scene: "studio",
        appearanceVariations: v,
      });
      expect(withV).toContain("facial details:");
      expect(withV).toContain(APPEARANCE_VARIATIONS.eyeColor[2]);
      expect(withV).toContain(APPEARANCE_VARIATIONS.eyeShape[1]);
    });
  });
});
