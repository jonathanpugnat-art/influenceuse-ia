import { frFR } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Syne } from "next/font/google";

import { PostHogProvider } from "@/components/posthog-provider";

import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: {
    default: "Ofmia",
    template: "%s · Ofmia",
  },
  description: "Visage verrouillé, niche, posts Instagram prêts à publier.",
};

export const viewport: Viewport = {
  themeColor: "#090b09",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`scheme-only-dark ${plex.variable} ${plexMono.variable} ${syne.variable}`}
    >
      <body className="antialiased">
        <ClerkProvider
          localization={frFR}
          signInUrl="/connexion"
          signUpUrl="/inscription"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
          appearance={{
            theme: dark,
            variables: {
              colorPrimary: "#d1fe17",
              colorPrimaryForeground: "#090b09",
              colorBackground: "#090b09",
              colorForeground: "#e8f0e4",
              colorMutedForeground: "#7a8a72",
              colorInput: "#141a14",
              colorInputForeground: "#e8f0e4",
              borderRadius: "0.125rem",
              fontFamily: "var(--font-plex), sans-serif",
            },
          }}
        >
          <PostHogProvider>{children}</PostHogProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
