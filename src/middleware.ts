import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/connexion(.*)",
  "/inscription(.*)",
  "/api/inngest(.*)",
  "/api/webhooks/replicate(.*)",
  "/api/webhooks/stripe(.*)",
  "/sentry-example-page(.*)",
  "/api/sentry-example-api(.*)",
  "/sentry-tunnel(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!sentry-tunnel|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
