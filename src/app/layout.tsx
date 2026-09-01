import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { TRPCProvider } from "@/providers/trpc-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Aura Influences — Le même visage. Sur chaque scène.",
  description:
    "Aura Influences : studio SaaS pour créer des influenceuses IA au visage verrouillé, générer photos et reels au crédit, et publier automatiquement sur Instagram et TikTok. Free 0 €, Creator 29 €, Pro 79 €, Agency 199 €.",
};

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "oklch(0.14 0.006 285 / 0.95)",
            border: "1px solid oklch(0.24 0.008 285 / 55%)",
            color: "oklch(0.985 0 0)",
          },
        }}
      />
    </TRPCProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <html lang="fr" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );

  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkProvider appearance={{ baseTheme: dark }}>
        {content}
      </ClerkProvider>
    );
  }

  return content;
}
