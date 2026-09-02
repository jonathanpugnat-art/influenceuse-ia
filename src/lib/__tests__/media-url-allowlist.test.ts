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

  it("rejects http even on an allowlisted hostname", () => {
    expect(
      isAllowedMediaDownloadUrl("http://media.example.com/content/abc.jpg")
    ).toBe(false);
    expect(isAllowedMediaDownloadUrl("http://replicate.delivery/out.png")).toBe(
      false
    );
  });

  it("allows https R2 and replicate.delivery URLs", () => {
    expect(
      isAllowedMediaDownloadUrl("https://replicate.delivery/out.png")
    ).toBe(true);
    expect(
      isAllowedMediaDownloadUrl("https://pbxt.replicate.delivery/out.png")
    ).toBe(true);
  });

  it("rejects loopback and metadata even over https", () => {
    expect(isAllowedMediaDownloadUrl("https://127.0.0.1/secret")).toBe(false);
    expect(isAllowedMediaDownloadUrl("https://169.254.169.254/latest")).toBe(
      false
    );
    expect(isAllowedMediaDownloadUrl("http://127.0.0.1/secret")).toBe(false);
  });
});

