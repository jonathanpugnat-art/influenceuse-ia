"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { clerkAuthPaths, clerkLocalization } from "@/lib/clerk-locale";

export function ClerkLocaleProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return children;
  }

  const paths = clerkAuthPaths(locale);
  return (
    <ClerkProvider
      appearance={{ baseTheme: dark }}
      localization={clerkLocalization(locale)}
      signInUrl={paths.signInUrl}
      signUpUrl={paths.signUpUrl}
      afterSignOutUrl={paths.afterSignOutUrl}
      signInFallbackRedirectUrl={paths.fallbackRedirectUrl}
      signUpFallbackRedirectUrl={paths.fallbackRedirectUrl}
    >
      {children}
    </ClerkProvider>
  );
}
