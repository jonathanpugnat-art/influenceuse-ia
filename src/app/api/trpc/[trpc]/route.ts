import { after } from "next/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/router";
import { createTRPCContext } from "@/server/trpc";

/** Photo/video generation can run 1–3 min on Replicate (with retries). */
export const maxDuration = 300;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createTRPCContext({
        scheduleAfter: (fn) => after(fn),
      }),
    onError({ error, path }) {
      console.error(`[trpc] Error on ${path}:`, error.message);
    },
  });

export { handler as GET, handler as POST };

