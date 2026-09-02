import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLookup = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
  lookup: mockLookup,
}));

import {
  assertSafeOutboundHttpsUrl,
  assertSafeOutboundWebhookUrl,
  isBlockedIp,
  isBlockedOutboundHostname,
  OutboundUrlBlockedError,
} from "@/lib/outbound-url-guard";

describe("outbound-url-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("blocks loopback, RFC1918, link-local and metadata IPs", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("10.0.0.8")).toBe(true);
    expect(isBlockedIp("172.16.1.1")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
    expect(isBlockedIp("169.254.1.1")).toBe(true);
    expect(isBlockedIp("169.254.169.254")).toBe(true);
    expect(isBlockedIp("0.0.0.0")).toBe(true);
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("fe80::1")).toBe(true);
    expect(isBlockedIp("fd00:ec2::254")).toBe(true);
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIp("::ffff:7f00:1")).toBe(true);
    expect(isBlockedIp("::ffff:a9fe:a9fe")).toBe(true);
    expect(isBlockedIp("93.184.216.34")).toBe(false);
    expect(isBlockedIp("::ffff:5db8:d822")).toBe(false);
  });

  it("blocks localhost and cloud metadata hostnames", () => {
    expect(isBlockedOutboundHostname("localhost")).toBe(true);
    expect(isBlockedOutboundHostname("metadata.google.internal")).toBe(true);
    expect(isBlockedOutboundHostname("169.254.169.254")).toBe(true);
    expect(isBlockedOutboundHostname("hooks.example.com")).toBe(false);
  });

  it("assertSafeOutboundHttpsUrl requires https and a public host", () => {
    expect(() => assertSafeOutboundHttpsUrl("http://127.0.0.1/hook")).toThrow(
      OutboundUrlBlockedError
    );
    expect(() =>
      assertSafeOutboundHttpsUrl("http://169.254.169.254/latest/meta-data")
    ).toThrow(OutboundUrlBlockedError);
    expect(() => assertSafeOutboundHttpsUrl("https://127.0.0.1/hook")).toThrow(
      OutboundUrlBlockedError
    );
    expect(() =>
      assertSafeOutboundHttpsUrl("https://metadata.google.internal/")
    ).toThrow(OutboundUrlBlockedError);
    expect(() =>
      assertSafeOutboundHttpsUrl("https://[::ffff:7f00:1]/hook")
    ).toThrow(OutboundUrlBlockedError);
    expect(() =>
      assertSafeOutboundHttpsUrl("https://[::ffff:a9fe:a9fe]/latest/meta-data")
    ).toThrow(OutboundUrlBlockedError);
    expect(assertSafeOutboundHttpsUrl("https://hooks.example.com/a").hostname).toBe(
      "hooks.example.com"
    );
  });

  it("assertSafeOutboundWebhookUrl rejects http loopback before DNS or fetch", async () => {
    await expect(
      assertSafeOutboundWebhookUrl("http://127.0.0.1/hook")
    ).rejects.toBeInstanceOf(OutboundUrlBlockedError);
    await expect(
      assertSafeOutboundWebhookUrl("http://169.254.169.254/latest/meta-data")
    ).rejects.toBeInstanceOf(OutboundUrlBlockedError);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("assertSafeOutboundWebhookUrl rejects a public name that resolves privately", async () => {
    mockLookup.mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
    await expect(
      assertSafeOutboundWebhookUrl("https://hooks.example.com/a")
    ).rejects.toBeInstanceOf(OutboundUrlBlockedError);
  });
});
