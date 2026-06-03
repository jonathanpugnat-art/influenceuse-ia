import { z } from "zod";
import {
  PHOTO_STUDIO_LOOKS,
  type PhotoStudioLook,
} from "@/lib/photo-studio-looks";
import type { InfluencerGender } from "@/lib/photo-niche-defaults";

export type PhotoAgentPhase = "looks" | "outfits" | "ready";

export type PhotoAgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const photoAgentTurnInputSchema = z.object({
  locale: z.enum(["fr", "en"]),
  gender: z.enum(["female", "male", "nonbinary"]),
  userMessage: z.string().max(500).optional(),
  selectedLookId: z.string().optional(),
  selectedOutfit: z.string().optional(),
  /** Number of assistant turns already shown (0 = first assistant reply). Max 2 before ready. */
  assistantTurnCount: z.number().int().min(0).max(2),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .max(12),
});

export type PhotoAgentTurnInput = z.infer<typeof photoAgentTurnInputSchema>;

export const photoAgentTurnOutputSchema = z.object({
  message: z.string().min(1).max(600),
  phase: z.enum(["looks", "outfits", "ready"]),
  suggestedLookIds: z.array(z.string()).max(3),
  suggestedOutfits: z.array(z.string()).max(4),
  showBrief: z.boolean(),
});

export type PhotoAgentTurnOutput = z.infer<typeof photoAgentTurnOutputSchema>;

export const PHOTO_AGENT_SYSTEM_PROMPT = `You are Aura Photo Studio — a friendly, premium creative assistant for AI influencer photos.

RULES:
- Warm, concise, encouraging tone. Never robotic.
- NEVER list form fields, dropdowns, or technical parameters (pose, timeOfDay, etc.).
- ALWAYS guide with visual choices — looks and outfits the user can tap.
- Max 2 assistant replies before the shoot brief is ready (looks → outfits → done).
- Respond in the user's locale (fr or en).

Return STRICT JSON only:
{
  "message": "short friendly text with one question max",
  "phase": "looks" | "outfits" | "ready",
  "suggestedLookIds": ["id1","id2","id3"],
  "suggestedOutfits": ["outfit1","outfit2"],
  "showBrief": false
}

Valid look ids (pick up to 3 that match intent):
${PHOTO_STUDIO_LOOKS.map((l) => `- ${l.id}: ${l.nameEn}`).join("\n")}

When phase is "outfits", suggestedOutfits must be concrete outfit descriptions (2-4 options).
When phase is "ready", showBrief is true and arrays can be empty.`;

const LOOK_KEYWORDS: Record<string, string[]> = {
  "cafe-aesthetic": ["café", "cafe", "coffee", "brunch", "cozy", "latte", "matin"],
  "mirror-selfie-gym": ["gym", "sport", "fitness", "workout", "miroir", "mirror", "muscu"],
  "beach-vibes": ["beach", "plage", "mer", "sun", "vacances", "bikini"],
  "airport-ootd": ["airport", "aéroport", "travel", "voyage", "ootd", "valise"],
  "rooftop-sunset": ["rooftop", "sunset", "coucher", "soirée", "evening", "terrasse"],
  "restaurant-chic": ["restaurant", "dîner", "dinner", "chic", "date", "gastronomie"],
  "morning-routine": ["morning", "matin", "routine", "pyjama", "home", "maison"],
  "street-style": ["street", "rue", "urban", "ville", "fashion", "mode"],
  "paris-landmark": ["paris", "landmark", "monument", "tour eiffel", "city"],
};

function scoreLookForText(look: PhotoStudioLook, text: string): number {
  const lower = text.toLowerCase();
  const keywords = LOOK_KEYWORDS[look.id] ?? [];
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) score += 2;
  }
  if (lower.includes(look.nameFr.toLowerCase())) score += 3;
  if (lower.includes(look.nameEn.toLowerCase())) score += 3;
  return score;
}

export function pickLooksForIntent(
  text: string,
  max = 3
): PhotoStudioLook[] {
  const trimmed = text.trim();
  const scored = PHOTO_STUDIO_LOOKS.map((look) => ({
    look,
    score: trimmed ? scoreLookForText(look, trimmed) : 0,
  })).sort((a, b) => b.score - a.score);

  const withHits = scored.filter((s) => s.score > 0).map((s) => s.look);
  if (withHits.length >= max) return withHits.slice(0, max);

  const defaults = [
    "cafe-aesthetic",
    "street-style",
    "morning-routine",
  ] as const;
  const picked = new Map<string, PhotoStudioLook>();
  for (const l of withHits) picked.set(l.id, l);
  for (const id of defaults) {
    if (picked.size >= max) break;
    const look = PHOTO_STUDIO_LOOKS.find((l) => l.id === id);
    if (look) picked.set(look.id, look);
  }
  for (const look of PHOTO_STUDIO_LOOKS) {
    if (picked.size >= max) break;
    picked.set(look.id, look);
  }
  return [...picked.values()].slice(0, max);
}

export function buildFallbackAgentTurn(
  input: PhotoAgentTurnInput,
  outfitOptions: string[]
): PhotoAgentTurnOutput {
  const fr = input.locale === "fr";

  if (input.selectedOutfit && input.selectedLookId) {
    return {
      message: fr
        ? "Parfait — ton brief est prêt. Tu peux générer quand tu veux ✨"
        : "Perfect — your brief is ready. Generate whenever you're ready ✨",
      phase: "ready",
      suggestedLookIds: [],
      suggestedOutfits: [],
      showBrief: true,
    };
  }

  if (input.selectedLookId) {
    const outfits = outfitOptions.slice(0, 4);
    return {
      message: fr
        ? "Super choix ! Laquelle de ces tenues te parle ?"
        : "Great pick! Which outfit speaks to you?",
      phase: "outfits",
      suggestedLookIds: [],
      suggestedOutfits: outfits,
      showBrief: false,
    };
  }

  const intent =
    input.userMessage?.trim() ||
    input.history.filter((m) => m.role === "user").pop()?.content ||
    "";
  const looks = pickLooksForIntent(intent, 3);

  return {
    message: fr
      ? "Voici des looks qui collent à ton idée — lequel tu choisis ?"
      : "Here are looks that match your vibe — which one do you pick?",
    phase: "looks",
    suggestedLookIds: looks.map((l) => l.id),
    suggestedOutfits: [],
    showBrief: false,
  };
}

export function validatePhotoAgentTurn(raw: unknown): PhotoAgentTurnOutput {
  const parsed = photoAgentTurnOutputSchema.parse(raw);
  const validIds = new Set(PHOTO_STUDIO_LOOKS.map((l) => l.id));
  return {
    ...parsed,
    suggestedLookIds: parsed.suggestedLookIds.filter((id) => validIds.has(id)),
  };
}

export function getLookById(id: string): PhotoStudioLook | undefined {
  return PHOTO_STUDIO_LOOKS.find((l) => l.id === id);
}

export function lookLabel(look: PhotoStudioLook, locale: string): string {
  return locale === "fr" ? look.nameFr : look.nameEn;
}

export type { InfluencerGender };
