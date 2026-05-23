import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAllowedMediaDownloadUrl } from "@/lib/media-url-allowlist";

describe("isAllowedMediaDownloadUrl", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.R2_PUBLIC_URL = "https://media.example.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  });

  afterEach(() => {
    process.env = env;
  });

  it("allows R2 public hostname", () => {
    expect(
      isAllowedMediaDownloadUrl("https://media.example.com/content/abc.jpg")
    ).toBe(true);
  });

  it("allows app uploads hostname", () => {
    expect(
      isAllowedMediaDownloadUrl("https://app.example.com/uploads/foo.jpg")
    ).toBe(true);
  });

  it("rejects arbitrary hosts", () => {
    expect(isAllowedMediaDownloadUrl("https://evil.com/image.jpg")).toBe(false);
  });
});
