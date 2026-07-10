import { describe, expect, it } from "vitest";
import { CREDIT_COSTS } from "@/lib/constants";
import {
  estimateLoraCreditCost,
  LORA_DATASET_SHOTS,
  LORA_MIN_DATASET_IMAGES,
  LORA_TARGET_DATASET_IMAGES,
  LORA_TRAINING_STEPS,
} from "@/lib/lora";

describe("LoRA economics", () => {
  it("charges 40 credits for full train, 30 when dataset is ready", () => {
    expect(CREDIT_COSTS.LORA_DATASET + CREDIT_COSTS.LORA_TRAINING).toBe(40);
    expect(estimateLoraCreditCost(false)).toBe(40);
    expect(estimateLoraCreditCost(true)).toBe(30);
  });

  it("uses a lean 12-shot dataset target", () => {
    expect(LORA_DATASET_SHOTS.length).toBe(12);
    expect(LORA_TARGET_DATASET_IMAGES).toBe(12);
    expect(LORA_MIN_DATASET_IMAGES).toBeLessThanOrEqual(
      LORA_DATASET_SHOTS.length + 1
    );
  });

  it("defaults training steps to 500 for margin control", () => {
    expect(LORA_TRAINING_STEPS).toBe(500);
  });
});
