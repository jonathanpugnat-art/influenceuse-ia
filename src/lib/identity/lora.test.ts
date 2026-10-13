import { describe, expect, it } from "vitest";

import {
  buildLoraPrompt,
  decideLoraActivation,
  makeTriggerWord,
  shouldEnableLora,
  shouldUseLoraForGeneration,
} from "@/lib/identity/lora";

describe("lora helpers", () => {
  it("génère un trigger stable", () => {
    expect(makeTriggerWord("11111111-1111-4111-8111-111111111111")).toBe("OFM11111");
  });

  it("préfixe le prompt", () => {
    expect(buildLoraPrompt("OFMABCDE", "cafe scene")).toBe("OFMABCDE, cafe scene");
  });

  it("n'active le LoRA que s'il bat la référence", () => {
    expect(shouldEnableLora({ loraMean: 0.8, referenceMean: 0.7 })).toBe(true);
    expect(shouldEnableLora({ loraMean: 0.6, referenceMean: 0.7 })).toBe(false);
    expect(shouldEnableLora({ loraMean: 0.75, referenceMean: null })).toBe(true);
  });

  it("accepte le training si scoring désactivé et prediction OK", () => {
    expect(
      decideLoraActivation({
        predictionSucceeded: true,
        scoringEnabled: false,
        loraMean: null,
        referenceMean: null,
      }),
    ).toBe(true);
    expect(
      decideLoraActivation({
        predictionSucceeded: true,
        scoringEnabled: true,
        loraMean: 0.6,
        referenceMean: 0.7,
      }),
    ).toBe(false);
  });

  it("branche la génération seulement si LoRA ready + activé", () => {
    expect(
      shouldUseLoraForGeneration({
        loraEnabledFlag: true,
        characterLoraEnabled: true,
        replicateVersion: "owner/model:abc",
        status: "ready",
      }),
    ).toBe(true);
    expect(
      shouldUseLoraForGeneration({
        loraEnabledFlag: true,
        characterLoraEnabled: true,
        replicateVersion: "owner/model:abc",
        status: "training",
      }),
    ).toBe(false);
  });
});
