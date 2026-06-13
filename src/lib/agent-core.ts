import { z } from "zod";
import { photoAgentTurnOutputSchema } from "@/lib/photo-studio-agent";
import { wizardStep2LookSchema } from "@/lib/prompts/wizard-prompts";

export const agentDomainSchema = z.enum([
  "wizard",
  "calendar",
  "trends",
  "photo",
]);

export type AgentDomain = z.infer<typeof agentDomainSchema>;

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  choices?: string[];
};

export const agentChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

export const agentTurnInputSchema = z.object({
  domain: agentDomainSchema,
  messages: z.array(agentChatMessageSchema).max(50),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type AgentTurnInput = z.infer<typeof agentTurnInputSchema>;

export const calendarPlanExecutionParamsSchema = z.object({
  influencerId: z.string(),
  days: z.number().int().min(1).max(14),
  postsPerDay: z.number().int().min(1).max(5),
  platforms: z
    .array(z.enum(["INSTAGRAM", "TIKTOK", "ONLYFANS"]))
    .min(1),
  language: z.enum(["fr", "en"]),
  goals: z.string().max(200).optional(),
  startDate: z.string().datetime().optional(),
  vibe: z.string().max(100).optional(),
});

export type CalendarPlanExecutionParams = z.infer<
  typeof calendarPlanExecutionParamsSchema
>;

export const wizardStep1SuggestionsOutputSchema = z.object({
  name: z.string().max(50).optional(),
  gender: z.enum(["female", "male", "nonbinary"]).optional(),
  niche: z
    .enum([
      "FASHION",
      "FITNESS",
      "LIFESTYLE",
      "TRAVEL",
      "TECH",
      "GAMING",
      "ADULT",
      "FOOD",
    ])
    .optional(),
  bio: z.string().max(300).optional(),
  personality: z.string().max(500).optional(),
  age: z.number().int().min(18).max(35).optional(),
  brief: z.string().max(1000).optional(),
});

export type WizardStep1SuggestionsOutput = z.infer<
  typeof wizardStep1SuggestionsOutputSchema
>;

export const agentTurnOutputSchema = z.object({
  message: z.string().min(1).max(2000),
  quickReplies: z.array(z.string().max(120)).max(6).optional(),
  choices: z.array(z.string().max(120)).max(6).optional(),
  action: z.string().max(80).optional(),
  readyToExecute: z.boolean().optional(),
  executionParams: calendarPlanExecutionParamsSchema.optional(),
  /** Wizard step 1 only — other domains omit this field. */
  wizardStep1Suggestions: wizardStep1SuggestionsOutputSchema.optional(),
  /** Wizard step 4 only — 2 (pro + authentic) or occasionally 3 variants. */
  bioOptions: z.array(z.string().min(1).max(300)).min(1).max(3).optional(),
  /** Wizard step 2 — appearance adjustments from chat. */
  wizardStep2Look: wizardStep2LookSchema.optional(),
  /** Photo studio agent — looks/outfits/ready phase. */
  photoAgentResult: photoAgentTurnOutputSchema.optional(),
});

export type AgentTurnOutput = z.infer<typeof agentTurnOutputSchema>;

export function toAgentChatHistory(
  messages: AgentMessage[]
): AgentTurnInput["messages"] {
  return messages.map(({ role, content }) => ({ role, content }));
}
