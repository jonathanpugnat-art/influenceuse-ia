"use client";

import posthog from "posthog-js";
import { PostHogProvider as Provider } from "posthog-js/react";
import { useEffect, type ReactNode } from "react";

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      persistence: "memory",
      capture_pageview: true,
      person_profiles: "identified_only",
    });
  }, []);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return children;
  return <Provider client={posthog}>{children}</Provider>;
}
