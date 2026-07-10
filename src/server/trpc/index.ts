import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { assertAiGenerationRateLimit } from "@/server/trpc/rate-limit";

export type ScheduleAfterFn = (fn: () => void | Promise<void>) => void;

export const createTRPCContext = async (opts?: {
  /** Next.js `after()` — keeps serverless alive for post-response work on Vercel. */
  scheduleAfter?: ScheduleAfterFn;
}) => {
  // Dynamically import Clerk auth only when keys are configured
  let userId: string | null = null;
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    try {
      const { auth } = await import("@clerk/nextjs/server");
      const session = await auth();
      userId = session.userId;
    } catch {
      // Clerk not configured, userId stays null
    }
  }

  const scheduleAfter: ScheduleAfterFn =
    opts?.scheduleAfter ??
    ((fn) => {
      void Promise.resolve(fn());
    });

  return { userId, scheduleAfter };
};

/** Test callers — runs scheduled work inline instead of Next.js `after()`. */
export function mockTRPCContext(userId: string | null) {
  return {
    userId,
    scheduleAfter: (fn: () => void | Promise<void>) => {
      void Promise.resolve(fn());
    },
  };
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export { mergeRouters } from "@trpc/server/unstable-core-do-not-import";
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next, path }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }

  await assertAiGenerationRateLimit(ctx.userId, path);

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});
