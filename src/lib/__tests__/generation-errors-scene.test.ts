import { describe, it, expect } from "vitest";
import { formatPhotoSceneErrorForUser } from "@/lib/generation-errors";

describe("formatPhotoSceneErrorForUser", () => {
  it("coaches on people in prompt", () => {
    expect(formatPhotoSceneErrorForUser("too many people in scene")).toContain(
      "sans personnages"
    );
  });

  it("returns generic coaching when empty", () => {
    expect(formatPhotoSceneErrorForUser(null)).toContain("regénérez le décor");
  });
});
