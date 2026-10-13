export function scrubSentryEvent<T extends Record<string, unknown>>(event: T): T {
  const serialized = JSON.stringify(event);
  let scrubbed = serialized
    .replace(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/g, "[redacted]")
    .replace(/X-Amz-[A-Za-z-]+=[^&\s"]+/g, "[redacted]")
    .replace(/"prompt"\s*:\s*"[^"]*"/g, '"prompt":"[redacted]"');
  try {
    return JSON.parse(scrubbed) as T;
  } catch {
    return event;
  }
}
