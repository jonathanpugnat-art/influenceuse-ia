import { db } from "@/server/db";

// ──────────────────────────────────────────────
// Onboarding service (Phase 6)
//
// Computes the user's activation checklist by inspecting their actual data:
// — has at least 1 influencer
// — has generated at least 1 photo
// — has connected at least 1 social account
// — has scheduled or published at least 1 content
// — has added a paid plan (or stayed on Free intentionally)
//
// We surface this on the dashboard so brand-new users see what to do next,
// instead of an empty stats grid.
// ──────────────────────────────────────────────

export interface ChecklistStep {
  id: string;
  /** Translation key in `dashboard.onboarding.steps.<id>`. */
  titleKey: string;
  /** Optional CTA target (relative URL). */
  cta?: string;
  done: boolean;
}

export interface OnboardingState {
  completed: boolean;
  /** 0..1 */
  progress: number;
  steps: ChecklistStep[];
}

export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const [influencerCount, contentCount, socialCount, scheduledCount, user] =
    await Promise.all([
      db.influencer.count({ where: { userId } }),
      db.content.count({
        where: { influencer: { userId }, status: { in: ["READY", "SCHEDULED", "PUBLISHED"] } },
      }),
      db.socialAccount.count({
        where: { influencer: { userId }, isConnected: true },
      }),
      db.content.count({
        where: { influencer: { userId }, status: { in: ["SCHEDULED", "PUBLISHED"] } },
      }),
      db.user.findUnique({ where: { id: userId }, select: { plan: true } }),
    ]);

  const steps: ChecklistStep[] = [
    {
      id: "createInfluencer",
      titleKey: "createInfluencer",
      cta: "/influencers/new",
      done: influencerCount >= 1,
    },
    {
      id: "generateFirstContent",
      titleKey: "generateFirstContent",
      cta: "/content/photo",
      done: contentCount >= 1,
    },
    {
      id: "connectSocial",
      titleKey: "connectSocial",
      cta: "/influencers",
      done: socialCount >= 1,
    },
    {
      id: "scheduleFirst",
      titleKey: "scheduleFirst",
      cta: "/calendar",
      done: scheduledCount >= 1,
    },
    {
      id: "upgradePlan",
      titleKey: "upgradePlan",
      cta: "/billing",
      done: user?.plan !== "FREE",
    },
  ];

  const totalRequired = steps.length - 1; // upgradePlan is optional/aspirational
  const doneRequired = steps.slice(0, totalRequired).filter((s) => s.done).length;
  const completed = doneRequired === totalRequired;
  const progress = totalRequired === 0 ? 1 : doneRequired / totalRequired;

  return { completed, progress, steps };
}
