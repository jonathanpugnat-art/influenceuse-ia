import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getInstagramOAuthProvider,
  usesInstagramDirectLogin,
} from "@/lib/instagram-oauth-config";
import { normalizeOAuthCode } from "@/server/services/instagram.service";

describe("instagram oauth config", () => {
  const prev = process.env.INSTAGRAM_OAUTH_MODE;

  afterEach(() => {
    if (prev === undefined) delete process.env.INSTAGRAM_OAUTH_MODE;
    else process.env.INSTAGRAM_OAUTH_MODE = prev;
  });

  it("defaults to instagram_login mode", () => {
    delete process.env.INSTAGRAM_OAUTH_MODE;
    expect(getInstagramOAuthProvider()).toBe("instagram_login");
    expect(usesInstagramDirectLogin()).toBe(true);
  });

  it("supports facebook mode", () => {
    process.env.INSTAGRAM_OAUTH_MODE = "facebook";
    expect(getInstagramOAuthProvider()).toBe("facebook_login");
    expect(usesInstagramDirectLogin()).toBe(false);
  });
});

describe("normalizeOAuthCode", () => {
  it("strips Meta hash suffix", () => {
    expect(normalizeOAuthCode("abc123#_")).toBe("abc123");
  });
});
