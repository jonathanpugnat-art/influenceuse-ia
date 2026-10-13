import * as Sentry from "@sentry/nextjs";

import { scrubSentryEvent } from "@/lib/observability/sentry";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  beforeSend(event) {
    return scrubSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event;
  },
});
