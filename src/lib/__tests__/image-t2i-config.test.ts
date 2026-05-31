import { describe, it, expect } from "vitest";
import {
  DEFAULT_FAL_FLUX_T2I_MODEL,
  mapDimensionsToFalImageSize,
  resolveFalFluxT2iModel,
  resolveImageT2iProviderMode,
  isFalImageConfigured,
} from "@/lib/image-t2i-config";
import { extractFalImageUrls } from "@/server/services/image-providers/fal-flux-t2i.provider";

describe("image-t2i-config", () => {
  it("defaults to auto provider mode", () => {
    expect(resolveImageT2iProviderMode({})).toBe("auto");
  });

  it("respects IMAGE_T2I_PROVIDER override", () => {
    expect(resolveImageT2iProviderMode({ IMAGE_T2I_PROVIDER: "fal" })).toBe("fal");
    expect(resolveImageT2iProviderMode({ IMAGE_T2I_PROVIDER: "replicate" })).toBe(
      "replicate"
    );
  });

  it("detects FAL_KEY presence", () => {
    expect(isFalImageConfigured({})).toBe(false);
    expect(isFalImageConfigured({ FAL_KEY: "test-key" })).toBe(true);
  });

  it("maps portrait dimensions to FAL preset", () => {
    expect(mapDimensionsToFalImageSize(1024, 1280)).toBe("portrait_4_3");
    expect(mapDimensionsToFalImageSize(1024, 1024)).toBe("square_hd");
  });

  it("falls back to default FAL model id", () => {
    expect(resolveFalFluxT2iModel({})).toBe(DEFAULT_FAL_FLUX_T2I_MODEL);
    expect(resolveFalFluxT2iModel({ FAL_FLUX_T2I_MODEL: "fal-ai/flux-pro/v1.1-ultra" })).toBe(
      "fal-ai/flux-pro/v1.1-ultra"
    );
  });
});

describe("extractFalImageUrls", () => {
  it("extracts urls from FAL images array", () => {
    const urls = extractFalImageUrls({
      images: [{ url: "https://fal.media/files/a.jpg" }],
    });
    expect(urls).toEqual(["https://fal.media/files/a.jpg"]);
  });
});
