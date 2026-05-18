"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { LowBalanceBanner } from "@/components/layout/low-balance-banner";
import { UpgradeModal } from "@/components/billing/upgrade-modal";
import { useSidebarStore } from "@/hooks/use-sidebar-store";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isCollapsed } = useSidebarStore();

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area — margin transitions smoothly with sidebar */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[margin-left] duration-300 ease-in-out",
          "md:ml-[280px]",
          isCollapsed && "md:ml-[72px]"
        )}
      >
        {/* Header */}
        <Header />

        {/* Page content — pb-28 on mobile leaves 112px under the last
            element so the fixed bottom nav (≈60px) + iOS safe area never
            overlap CTAs at the page footer. md+ resets to pb-6. */}
        <main className="flex-1 px-4 py-6 pb-28 md:px-6 md:pb-6 lg:px-8">
          <div className="mb-4">
            <LowBalanceBanner />
          </div>
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />

      {/* Phase 6 — global upgrade modal triggered by feature gates */}
      <UpgradeModal />
    </div>
  );
}
