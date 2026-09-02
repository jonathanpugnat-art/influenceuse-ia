/**
 * Outbound SSRF guard — shared by user-configured webhooks and any other
 * server-side fetch of a caller-supplied URL.
 *
 * Blocks non-https, loopback, RFC1918, link-local, cloud metadata IPs
 * (169.254.169.254 and IPv6 ULA), and obvious metadata hostnames.
 * Hostname checks are sync; webhook delivery also resolves DNS so a
 * public name that points at a blocked address is rejected.
 */

import { lookup } from "node:dns/promises";
import net from "node:net";

export class OutboundUrlBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboundUrlBlockedError";
  }
}

const BLOCKED_METADATA_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
  "metadata.google.com",
  "metadata.aws.internal",
  "instance-data",
  "kubernetes.default",
  "kubernetes.default.svc",
  "kubernetes.default.svc.cluster.local",
]);

export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

export function isBlockedIp(address: string): boolean {
  const host = normalizeHostname(address);
  if (net.isIPv4(host)) return isBlockedIpv4(host);
  if (net.isIPv6(host)) return isBlockedIpv6(host);
  return false;
}

export function isBlockedOutboundHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (BLOCKED_METADATA_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost")) return true;
  if (host.endsWith(".metadata.google.internal")) return true;
  return isBlockedIp(host);
}

/**
 * Sync checks (scheme + hostname / IP literal). Does not resolve DNS.
 */
export function assertSafeOutboundHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new OutboundUrlBlockedError("Invalid webhook URL");
  }
  if (url.protocol !== "https:") {
    throw new OutboundUrlBlockedError("Webhook URL must be https");
  }
  if (url.username || url.password) {
    throw new OutboundUrlBlockedError("Webhook URL must not include credentials");
  }
  if (isBlockedOutboundHostname(url.hostname)) {
    throw new OutboundUrlBlockedError(`Blocked outbound host: ${url.hostname}`);
  }
  return url;
}

/**
 * Full webhook check: https + blocked hosts/IPs + DNS must not resolve
 * to a private / metadata address. Fail-closed on DNS errors.
 */
export async function assertSafeOutboundWebhookUrl(
  raw: string
): Promise<URL> {
  const url = assertSafeOutboundHttpsUrl(raw);
  let records: Array<{ address: string }>;
  try {
    records = await lookup(url.hostname, { all: true });
  } catch {
    throw new OutboundUrlBlockedError("Could not resolve webhook host");
  }
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new OutboundUrlBlockedError(
        `Blocked outbound destination: ${record.address}`
      );
    }
  }
  return url;
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map((p) => Number(p));
  const [a, b, c, d] = parts;
  if (
    parts.length !== 4 ||
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return true;
  }
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16
  return false;
}

function isBlockedIpv6(address: string): boolean {
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  const mappedV4 = mapped?.[1];
  if (mappedV4) return isBlockedIpv4(mappedV4);
  const hex = expandIpv6(address);
  if (!hex) return true;
  if (hex === "00000000000000000000000000000000") return true; // ::
  if (hex === "00000000000000000000000000000001") return true; // ::1
  // IPv4-mapped hex (::ffff:7f00:1, ::ffff:a9fe:a9fe) — dotted :ffff:a.b.c.d
  // is handled above because expandIpv6 refuses embedded dots.
  if (hex.startsWith("00000000000000000000ffff")) {
    const a = Number.parseInt(hex.slice(24, 26), 16);
    const b = Number.parseInt(hex.slice(26, 28), 16);
    const c = Number.parseInt(hex.slice(28, 30), 16);
    const d = Number.parseInt(hex.slice(30, 32), 16);
    if ([a, b, c, d].some((n) => Number.isNaN(n))) return true;
    return isBlockedIpv4(`${a}.${b}.${c}.${d}`);
  }
  const first = Number.parseInt(hex.slice(0, 4), 16);
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7
  return false;
}

function expandIpv6(address: string): string | null {
  const lower = address.toLowerCase();
  if (lower.includes(".")) return null;
  const [head, tail] = lower.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  if (lower.includes("::")) {
    const missing = 8 - headParts.length - tailParts.length;
    if (missing < 0) return null;
    const filled = [
      ...headParts,
      ...Array.from({ length: missing }, () => "0"),
      ...tailParts,
    ];
    if (filled.length !== 8) return null;
    return filled.map((p) => p.padStart(4, "0")).join("");
  }
  const parts = lower.split(":");
  if (parts.length !== 8) return null;
  return parts.map((p) => p.padStart(4, "0")).join("");
}
