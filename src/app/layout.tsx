import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Aura Influences — Créez vos influenceuses IA",
  description:
    "Aura Influences est la plateforme tout-en-un pour créer, animer et publier des influenceuses virtuelles générées par IA. Photos iPhone-réelles, reels TikTok, planning auto. Bêta gratuite.",
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
  return (
    <html lang="fr" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
