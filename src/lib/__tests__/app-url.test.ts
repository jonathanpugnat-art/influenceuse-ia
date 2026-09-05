import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAppUrl,
  getAppUrlHost,
  PROD_APP_ORIGIN,
} from "@/lib/app-url";

describe("getAppUrl production host", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("resolves apex NEXT_PUBLIC_APP_URL to https://www.aurainfluenceai.com", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://aurainfluenceai.com";
    expect(getAppUrl()).toBe(PROD_APP_ORIGIN);
    expect(getAppUrlHost()).toBe("www.aurainfluenceai.com");
  });

  it("keeps www as the production origin", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.aurainfluenceai.com/";
    expect(getAppUrl()).toBe(PROD_APP_ORIGIN);
    expect(getAppUrlHost()).toBe("www.aurainfluenceai.com");
  });

  it("does not rewrite localhost or preview hosts", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(getAppUrl()).toBe("http://localhost:3000");
    process.env.NEXT_PUBLIC_APP_URL = "https://aura-preview.vercel.app";
    expect(getAppUrl()).toBe("https://aura-preview.vercel.app");
  });
});
