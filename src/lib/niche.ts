export type Niche = {
  subject: string;
  audience: string;
  promise: string;
  tone: string;
};

function field(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < 2 || text.length > 80) return null;
  return text;
}

export function parseNiche(input: unknown): Niche | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const subject = field(record.subject);
  const audience = field(record.audience);
  const promise = field(record.promise);
  const tone = field(record.tone);
  if (!subject || !audience || !promise || !tone) return null;
  return { subject, audience, promise, tone };
}
