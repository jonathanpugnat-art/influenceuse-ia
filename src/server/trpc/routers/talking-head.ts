import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { db } from "@/server/db";
import { getDbUser } from "@/server/helpers/get-db-user";
import {
  cloneVoice,
  isElevenLabsConfigured,
  listLibraryVoices,
  synthesizeVoicePreview,
} from "@/server/services/elevenlabs.service";
import {
  pollTalkingHeadJob,
  readTalkingHeadConfig,
  startTalkingHeadJob,
} from "@/server/services/talking-head.service";
import {
  estimateTalkingHeadCredits,
  estimateTalkingHeadDurationSec,
  validateTalkingHeadScript,
} from "@/lib/talking-head";
import { MAX_TALKING_HEAD_WORDS } from "@/lib/constants";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function requireInfluencer(userDbId: string, influencerId: string) {
  const influencer = await db.influencer.findFirst({
    where: { id: influencerId, userId: userDbId },
  });
  if (!influencer) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Personnage introuvable ou non accessible.",
    });
  }
  return influencer;
}

// ──────────────────────────────────────────────
// Zod schemas
// ──────────────────────────────────────────────

const languageSchema = z.enum(["fr", "en", "es", "de", "it", "pt", "nl"]);

const cloneVoiceSchema = z.object({
  influencerId: z.string().min(1),
  sampleUrl: z.string().url(),
  displayName: z.string().min(1).max(80).optional(),
  language: languageSchema.optional(),
  consent: z
    .literal(true)
    .refine((v) => v === true, "Consentement obligatoire."),
});

const setLibraryVoiceSchema = z.object({
  influencerId: z.string().min(1),
  voiceId: z.string().min(1),
  displayName: z.string().min(1).max(80).optional(),
  language: languageSchema.optional(),
  consent: z
    .literal(true)
    .refine((v) => v === true, "Consentement obligatoire."),
});

const startJobSchema = z.object({
  influencerId: z.string().min(1),
  script: z.string().min(1).max(4000),
  language: languageSchema.optional(),
});

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const talkingHeadRouter = createTRPCRouter({
  /** Global config — used by the UI to show/hide the feature and price. */
  getConfig: protectedProcedure.query(() => {
    const cfg = readTalkingHeadConfig();
    return {
      ...cfg,
      maxWords: MAX_TALKING_HEAD_WORDS,
    };
  }),

  /**
   * Voice status for a character — the UI uses this to decide whether
   * to render the picker or the "already set" summary.
   */
  getVoice: protectedProcedure
    .input(z.object({ influencerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const inf = await requireInfluencer(user.id, input.influencerId);
      return {
        voiceId: inf.voiceId,
        voiceProvider: inf.voiceProvider,
        voiceLabel: inf.voiceLabel,
        voiceLanguage: inf.voiceLanguage,
        consentAt: inf.voiceConsentAt,
        sampleUrl: inf.voiceSampleUrl,
      };
    }),

  /**
   * Estimate cost + duration from a script, without holding credits.
   * Used to render the live counter and the "will cost X" pill in the UI.
   */
  estimate: protectedProcedure
    .input(z.object({ script: z.string() }))
    .query(({ input }) => {
      const words = validateTalkingHeadScript(input.script).words;
      const duration = estimateTalkingHeadDurationSec(input.script);
      const cost = estimateTalkingHeadCredits(duration);
      return { words, durationSec: duration, cost };
    }),

  /**
   * List the Voice Library (ElevenLabs shared voices). Recommended when the
   * user doesn't want to clone yet — Default voices are excluded server-side.
   */
  listLibraryVoices: protectedProcedure
    .input(
      z
        .object({
          gender: z.enum(["male", "female"]).optional(),
          language: z.string().min(2).max(6).optional(),
          search: z.string().max(80).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      if (!isElevenLabsConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "ELEVENLABS_API_KEY manquant — bibliothèque voix indisponible.",
        });
      }
      return listLibraryVoices({
        gender: input?.gender,
        language: input?.language,
        search: input?.search,
      });
    }),

  /**
   * Clone the character voice from a sample previously uploaded to
   * `/api/media/voice-sample`. Sample must live on our storage so
   * ElevenLabs can fetch it (redirect chain limits apply). Consent must
   * be true — matches the checkbox in the UI.
   */
  cloneVoice: protectedProcedure
    .input(cloneVoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const influencer = await requireInfluencer(user.id, input.influencerId);
      if (!isElevenLabsConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "ELEVENLABS_API_KEY manquant — le clone voix nécessite un compte ElevenLabs.",
        });
      }

      const label =
        input.displayName?.trim() || `Aura ${influencer.name.slice(0, 60)}`;
      const clone = await cloneVoice({
        sampleUrl: input.sampleUrl,
        name: label,
        description: `Aura Influences — voix synthétique pour ${influencer.name}.`,
      });

      const updated = await db.influencer.update({
        where: { id: influencer.id },
        data: {
          voiceId: clone.voiceId,
          voiceProvider: "elevenlabs",
          voiceLabel: label,
          voiceLanguage: input.language ?? influencer.voiceLanguage ?? "fr",
          voiceConsentAt: new Date(),
          voiceSampleUrl: input.sampleUrl,
        },
        select: {
          voiceId: true,
          voiceProvider: true,
          voiceLabel: true,
          voiceLanguage: true,
          voiceConsentAt: true,
          voiceSampleUrl: true,
        },
      });
      return updated;
    }),

  /**
   * Pick a Voice Library voice (no clone). Persists identically so downstream
   * `startJob` doesn't need to branch on provider.
   */
  setLibraryVoice: protectedProcedure
    .input(setLibraryVoiceSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const influencer = await requireInfluencer(user.id, input.influencerId);

      const updated = await db.influencer.update({
        where: { id: influencer.id },
        data: {
          voiceId: input.voiceId,
          voiceProvider: "library",
          voiceLabel: input.displayName?.trim() || influencer.voiceLabel,
          voiceLanguage: input.language ?? influencer.voiceLanguage ?? "fr",
          voiceConsentAt: new Date(),
          voiceSampleUrl: null,
        },
        select: {
          voiceId: true,
          voiceProvider: true,
          voiceLabel: true,
          voiceLanguage: true,
          voiceConsentAt: true,
          voiceSampleUrl: true,
        },
      });
      return updated;
    }),

  /**
   * Detach the voice — useful for GDPR / voice signature reset.
   */
  clearVoice: protectedProcedure
    .input(z.object({ influencerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      await requireInfluencer(user.id, input.influencerId);
      await db.influencer.update({
        where: { id: input.influencerId },
        data: {
          voiceId: null,
          voiceProvider: null,
          voiceLabel: null,
          voiceConsentAt: null,
          voiceSampleUrl: null,
        },
      });
      return { ok: true as const };
    }),

  /**
   * 3s preview — plays back a short sample of the CURRENT character voice.
   * Uses ElevenLabs Flash 2.5 so latency + cost stay low.
   */
  previewVoice: protectedProcedure
    .input(
      z.object({
        influencerId: z.string(),
        text: z.string().min(2).max(140).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const influencer = await requireInfluencer(user.id, input.influencerId);
      if (!influencer.voiceId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Aucune voix configurée pour ce personnage.",
        });
      }
      const preview = await synthesizeVoicePreview({
        voiceId: influencer.voiceId,
        text:
          input.text ??
          "Bonjour, je suis prête à parler à ta communauté.",
      });
      const base64 = preview.audio.toString("base64");
      return {
        audioBase64: base64,
        contentType: preview.contentType,
      };
    }),

  /**
   * Kick off a talking-head render. Returns the job id + estimated cost
   * so the UI can start polling.
   */
  startJob: protectedProcedure
    .input(startJobSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      return startTalkingHeadJob({
        userId: user.id,
        influencerId: input.influencerId,
        script: input.script,
        language: input.language,
      });
    }),

  /**
   * Poll one job. The UI calls this on a 3-5s interval while a preview is
   * generating; the cron does the same for jobs the user closed.
   */
  getJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      const job = await db.talkingHeadJob.findFirst({
        where: { id: input.jobId, userId: user.id },
      });
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job introuvable." });
      }
      if (job.status === "PROCESSING") {
        return pollTalkingHeadJob(job.id);
      }
      return job;
    }),

  /**
   * List recent jobs for the character (used by the history strip under
   * the player).
   */
  listJobs: protectedProcedure
    .input(
      z.object({
        influencerId: z.string(),
        limit: z.number().int().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await getDbUser(ctx.userId);
      return db.talkingHeadJob.findMany({
        where: { userId: user.id, influencerId: input.influencerId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});
