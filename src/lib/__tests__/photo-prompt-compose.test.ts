import { describe, it, expect } from "vitest";
import {
  composePhotoParamsFromPrompt,
  extractOutfitFromUserPrompt,
  inferContentModeFromPrompt,
  inferLightingFromPrompt,
  inferPhotoStyleFromPrompt,
  pickOutfitFromPrompt,
} from "@/lib/photo-prompt-compose";

describe("photo-prompt-compose", () => {
  it("routes suggestive prompts to NSFW when plan allows", () => {
    expect(
      inferContentModeFromPrompt("miroir lingerie chambre", {
        influencerIsNsfw: false,
        hasNsfwPlan: true,
      })
    ).toBe("NSFW");
  });

  it("stays SFW for neutral prompts without adult influencer", () => {
    expect(
      inferContentModeFromPrompt("selfie café parisien", {
        influencerIsNsfw: false,
        hasNsfwPlan: true,
      })
    ).toBe("SFW");
  });

  it("forces NSFW for adult influencers on premium plan", () => {
    expect(
      inferContentModeFromPrompt("portrait studio", {
        influencerIsNsfw: true,
        hasNsfwPlan: true,
      })
    ).toBe("NSFW");
  });

  it("composes params from a single prompt", () => {
    const params = composePhotoParamsFromPrompt({
      prompt: "selfie cozy au café, pull beige, lumière matinale",
      gender: "female",
      influencerIsNsfw: false,
      hasNsfwPlan: false,
    });
    expect(params.contentMode).toBe("SFW");
    expect(params.sceneDescription).toContain("café");
    expect(params.outfit?.length).toBeGreaterThan(0);
  });

  it("picks premium look for boudoir prompt", () => {
    const params = composePhotoParamsFromPrompt({
      prompt: "photo boudoir chambre lingerie dentelle",
      gender: "female",
      influencerIsNsfw: false,
      hasNsfwPlan: true,
    });
    expect(params.contentMode).toBe("NSFW");
    expect(params.lookId).toMatch(/boudoir|lingerie|premium/);
  });

  it("scores outfit from prompt keywords", () => {
    const picked = pickOutfitFromPrompt("tenue gym legging noir", [
      "pull oversized beige",
      "legging noir et brassière sport",
      "robe midi casual",
    ]);
    expect(picked).toContain("legging");
  });

  it("extracts explicit outfit from user prompt", () => {
    const outfit = extractOutfitFromUserPrompt(
      "selfie dans sa chambre avec un outfit brassière de sport moulante ou on vois sa poitrine"
    );
    expect(outfit).toContain("brassière de sport");
    expect(outfit).not.toMatch(/dentelle|lingerie rouge/i);
  });

  it("keeps sports bra outfit instead of boudoir preset", () => {
    const params = composePhotoParamsFromPrompt({
      prompt:
        "selfie dans sa chambre avec un outfit brassière de sport moulante ou on vois sa poitrine",
      gender: "female",
      influencerIsNsfw: false,
      hasNsfwPlan: true,
    });
    expect(params.contentMode).toBe("NSFW");
    expect(params.outfit).toContain("brassière de sport");
    expect(params.outfit).not.toMatch(/dentelle rouge/i);
    expect(params.pose).toBe("selfie");
    expect(params.sceneDescription).toContain("chambre");
    expect(params.customPrompt).toBe("");
    expect(params.customPrompt).not.toBe(params.sceneDescription);
  });

  it("overrides look lighting from boudoir prompt", () => {
    const params = composePhotoParamsFromPrompt({
      prompt: "photo boudoir nuit lumière bougie",
      gender: "female",
      influencerIsNsfw: false,
      hasNsfwPlan: true,
    });
    expect(params.timeOfDay).toBe("neon");
    expect(params.photoStyle).toBe("cinematic");
  });
});

describe("inferLightingFromPrompt", () => {
  it("détecte neon depuis boudoir", () => {
    expect(inferLightingFromPrompt("photo boudoir lumière tamisée")).toBe("neon");
  });
  it("détecte neon depuis bougie", () => {
    expect(inferLightingFromPrompt("selfie chambre avec bougies")).toBe("neon");
  });
  it("détecte golden_hour depuis plage", () => {
    expect(
      inferLightingFromPrompt("photo sur la plage au coucher du soleil")
    ).toBe("golden_hour");
  });
  it("détecte blue_hour depuis Paris by night", () => {
    expect(
      inferLightingFromPrompt("paris by night vue sur la tour eiffel")
    ).toBe("blue_hour");
  });
  it("retourne null si pas de signal", () => {
    expect(inferLightingFromPrompt("selfie dans ma chambre")).toBeNull();
  });
});

describe("inferPhotoStyleFromPrompt", () => {
  it("détecte cinematic depuis boudoir NSFW", () => {
    expect(inferPhotoStyleFromPrompt("photo boudoir sombre", "NSFW")).toBe(
      "cinematic"
    );
  });
  it("retourne natural pour NSFW sans signal", () => {
    expect(inferPhotoStyleFromPrompt("selfie chambre", "NSFW")).toBe("natural");
  });
  it("détecte editorial depuis café chic", () => {
    expect(
      inferPhotoStyleFromPrompt("photo dans un café chic parisien", "SFW")
    ).toBe("editorial");
  });
  it("détecte vintage depuis polaroid", () => {
    expect(inferPhotoStyleFromPrompt("style polaroid années 90", "SFW")).toBe(
      "vintage"
    );
  });
  it("retourne null si pas de signal", () => {
    expect(inferPhotoStyleFromPrompt("selfie gym", "SFW")).toBeNull();
  });
});
