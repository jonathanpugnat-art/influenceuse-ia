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
  title: "Influenceuse IA",
  description:
    "Plateforme de création et gestion d'influenceuses virtuelles par IA",
};

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "rgb(15 23 42 / 0.9)",
            border: "1px solid rgb(30 41 59 / 0.5)",
            color: "white",
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
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-slate-950 text-white`}
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
