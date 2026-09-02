"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  LayoutDashboard,
  ImagePlus,
  Calendar,
  BarChart3,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  TrendingUp,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useSidebarStore } from "@/hooks/use-sidebar-store";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { useTrpcPrefetch } from "@/hooks/use-trpc-prefetch";
import { cn } from "@/lib/utils";
import { isNavHrefActive } from "@/lib/nav-active";

// Dynamic clerk hooks wrapper to avoid SSR issues without ClerkProvider
const ClerkUserSection = dynamic(
  () => import("@/components/layout/clerk-user-section"),
  { ssr: false }
);

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const mainNavItems = [
  { labelKey: "common.dashboard", icon: LayoutDashboard, href: "/influencers" },
  { labelKey: "dashboard.createContent", icon: ImagePlus, href: "/content/photo" },
  { labelKey: "common.calendar", icon: Calendar, href: "/calendar" },
  { labelKey: "common.library", icon: FolderOpen, href: "/library" },
  { labelKey: "common.trends", icon: TrendingUp, href: "/trends" },
  { labelKey: "common.analytics", icon: BarChart3, href: "/analytics" },
];

const secondaryNavItems = [
  { labelKey: "common.billing", icon: CreditCard, href: "/billing" },
  { labelKey: "common.settings", icon: Settings, href: "/settings" },
];

function NavItem({
  item,
  label,
  isActive,
  isCollapsed,
  onPrefetch,
}: {
  item: (typeof mainNavItems)[0];
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
  onPrefetch?: () => void;
}) {
  const content = (
    <Link
      href={item.href}
      onMouseEnter={onPrefetch}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
        isActive
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-foreground"
          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
        />
      )}
      <item.icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      <AnimatePresence mode="wait">
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="truncate"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function CreditsSection({ isCollapsed }: { isCollapsed: boolean }) {
  const t = useTranslations("common");
  const tLayout = useTranslations("layout");
  const { data, isLoading } = useCurrentPlan();

  // Sprint 14 — bugfix: show a skeleton during load instead of "0 / 50",
  // which was flashing for ~1s before the real ENTERPRISE/5000 numbers
  // hydrated. New users on FREE plan briefly saw "0 / 50 utilisés" too,
  // making the app feel less generous than it is.
  if (isLoading || !data) {
    if (isCollapsed) {
      return (
        <div className="flex items-center justify-center px-3 py-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
        </div>
      );
    }
    return (
      <div className="surface-muted p-3">
        <div className="mb-2 h-3 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-1.5 w-full animate-pulse rounded bg-muted" />
        <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const creditsUsed = data.creditsUsed;
  const creditsLimit = data.creditsLimit;
  const creditsRemaining =
    data.creditsRemaining ?? Math.max(0, creditsLimit - creditsUsed);
  const progressPercent = creditsLimit > 0 ? (creditsUsed / creditsLimit) * 100 : 0;

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center px-3 py-2">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-muted"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${progressPercent * 0.88} 88`}
                  strokeLinecap="round"
                  className="text-foreground"
                />
              </svg>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          {creditsRemaining} {t("credits")} {t("remaining")}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="surface-muted p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{t("credits")}</span>
        <span className="font-medium text-foreground">
          {creditsRemaining} {t("remaining")}
        </span>
      </div>
      <Progress value={progressPercent} className="h-1 bg-muted" />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {tLayout("creditsUsed", { used: creditsUsed, limit: creditsLimit })}
      </p>
    </div>
  );
}

function FallbackUserSection({ isCollapsed }: { isCollapsed: boolean }) {
  const t = useTranslations("layout");
  const avatar = (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
      <div className="flex h-full w-full items-center justify-center text-sm font-medium text-foreground">
        U
      </div>
    </div>
  );

  if (isCollapsed) {
    return (
      <div className="flex w-full items-center justify-center rounded-xl px-3 py-2">
        {avatar}
      </div>
    );
  }

  return (
    <div className="flex w-full items-center gap-3 rounded-xl px-3 py-2">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{t("user")}</p>
        <p className="truncate text-xs text-muted-foreground">user@example.com</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { isCollapsed, toggleCollapsed } = useSidebarStore();
  const { prefetchContent, prefetchTrends, prefetchDashboard } = useTrpcPrefetch();

  const prefetchForHref = (href: string) => {
    if (href === "/content/photo") return prefetchContent;
    if (href === "/trends") return prefetchTrends;
    return prefetchDashboard;
  };

  const isActive = (href: string) => isNavHrefActive(pathname, href);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 280 }}
      transition={{ type: "spring", bounce: 0.1, duration: 0.35 }}
      className="fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-border/40 bg-sidebar/90 backdrop-blur-2xl md:flex"
    >
      <div className="flex h-full flex-col overflow-hidden">
        {/* Logo + Collapse toggle */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link href="/influencers" className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-card/60">
              <Sparkles className="h-4 w-4 text-foreground" />
            </div>
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="whitespace-nowrap text-base font-semibold tracking-tight text-foreground"
                >
                  Aura{" "}
                  <span className="text-muted-foreground font-normal">Influences</span>
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          <button
            onClick={toggleCollapsed}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {mainNavItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              label={t(item.labelKey)}
              isActive={isActive(item.href)}
              isCollapsed={isCollapsed}
              onPrefetch={prefetchForHref(item.href)}
            />
          ))}

          <div className="py-2">
            <Separator className="bg-border" />
          </div>

          {secondaryNavItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              label={t(item.labelKey)}
              isActive={isActive(item.href)}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        {/* Bottom section: credits + user */}
        <div className="mt-auto space-y-2 border-t border-border px-3 py-3">
          <CreditsSection isCollapsed={isCollapsed} />
          {hasClerk ? (
            <ClerkUserSection isCollapsed={isCollapsed} />
          ) : (
            <FallbackUserSection isCollapsed={isCollapsed} />
          )}
        </div>
      </div>
    </motion.aside>
  );
}
