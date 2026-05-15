"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  LayoutDashboard,
  Users,
  ImagePlus,
  Calendar,
  BarChart3,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User as UserIcon,
  MoreHorizontal,
  FolderOpen,
  TrendingUp,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useSidebarStore } from "@/hooks/use-sidebar-store";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// Dynamic clerk hooks wrapper to avoid SSR issues without ClerkProvider
const ClerkUserSection = dynamic(
  () => import("@/components/layout/clerk-user-section"),
  { ssr: false }
);

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const mainNavItems = [
  { labelKey: "common.dashboard", icon: LayoutDashboard, href: "/" },
  { labelKey: "common.influencers", icon: Users, href: "/influencers" },
  { labelKey: "dashboard.createContent", icon: ImagePlus, href: "/content" },
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
}: {
  item: (typeof mainNavItems)[0];
  label: string;
  isActive: boolean;
  isCollapsed: boolean;
}) {
  const content = (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-violet-500/10 text-violet-400"
          : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
      )}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-violet-500"
          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
        />
      )}
      <item.icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors",
          isActive ? "text-violet-400" : "text-slate-500 group-hover:text-white"
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
  const { data } = trpc.billing.getCurrentPlan.useQuery();
  const creditsUsed = data?.creditsUsed ?? 0;
  const creditsLimit = data?.creditsLimit ?? 50;
  const creditsRemaining = data?.creditsRemaining ?? Math.max(0, creditsLimit - creditsUsed);
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
                  className="text-slate-800"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="url(#credit-gradient)"
                  strokeWidth="3"
                  strokeDasharray={`${progressPercent * 0.88} 88`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient
                    id="credit-gradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
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
    <div className="rounded-xl bg-slate-800/30 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-slate-400">{t("credits")}</span>
        <span className="font-medium text-white">
          {creditsRemaining} {t("remaining")}
        </span>
      </div>
      <Progress value={progressPercent} className="h-1.5 bg-slate-700" />
      <p className="mt-1.5 text-xs text-slate-500">
        {creditsUsed} / {creditsLimit} utilisés
      </p>
    </div>
  );
}

function FallbackUserSection({ isCollapsed }: { isCollapsed: boolean }) {
  const avatar = (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
      <div className="flex h-full w-full items-center justify-center text-sm font-medium text-white">
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
        <p className="truncate text-sm font-medium text-white">Utilisateur</p>
        <p className="truncate text-xs text-slate-500">user@example.com</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const t = useTranslations();
  const pathname = usePathname();
  const { isCollapsed, toggleCollapsed } = useSidebarStore();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 280 }}
      transition={{ type: "spring", bounce: 0.1, duration: 0.35 }}
      className="fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-slate-800/50 bg-slate-900/80 backdrop-blur-xl md:flex"
    >
      <div className="flex h-full flex-col overflow-hidden">
        {/* Logo + Collapse toggle */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/50 px-4">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="whitespace-nowrap text-base font-bold text-white"
                >
                  Influenceuse{" "}
                  <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                    IA
                  </span>
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          <button
            onClick={toggleCollapsed}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
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
            />
          ))}

          <div className="py-2">
            <Separator className="bg-slate-800/50" />
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
        <div className="mt-auto space-y-2 border-t border-slate-800/50 px-3 py-3">
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
