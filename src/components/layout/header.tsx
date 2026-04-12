"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  Bell,
  ChevronRight,
  ArrowUpRight,
  UserCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

const UserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.UserButton),
  { ssr: false }
);

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function Breadcrumb() {
  const pathname = usePathname();
  const t = useTranslations("layout");
  const segments = pathname.split("/").filter(Boolean);

  const routeLabels: Record<string, string> = {
    "/": t("dashboard"),
    "/influencers": t("influencers"),
    "/influencers/new": t("newInfluencer"),
    "/content": t("createContent"),
    "/content/photo": t("photoCreator"),
    "/content/reel": t("reelCreator"),
    "/calendar": t("calendar"),
    "/analytics": t("analytics"),
    "/billing": t("billing"),
    "/settings": t("settings"),
  };

  if (segments.length === 0) {
    return <span className="text-lg font-semibold text-white">{t("dashboard")}</span>;
  }

  const crumbs: { label: string; href: string }[] = [];
  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = routeLabels[currentPath] ?? decodeURIComponent(segment);
    crumbs.push({ label, href: currentPath });
  }

  return (
    <div className="flex items-center gap-1.5">
      {crumbs.map((crumb, i) => (
        <div key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-600" />}
          <span
            className={cn(
              "text-sm",
              i === crumbs.length - 1
                ? "font-semibold text-white"
                : "text-slate-400"
            )}
          >
            {crumb.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function PlanBadge() {
  const { data } = trpc.billing.getCurrentPlan.useQuery();
  const t = useTranslations("layout");
  const plan = (data?.plan ?? "FREE") as "FREE" | "PRO" | "ENTERPRISE";

  if (plan === "ENTERPRISE") {
    return (
      <Badge className="border-0 bg-gradient-to-r from-violet-500 to-indigo-500 px-2.5 py-0.5 text-xs text-white">
        {t("planEnterprise")}
      </Badge>
    );
  }

  if (plan === "PRO") {
    return (
      <Badge className="border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs text-violet-400">
        {t("planPro")}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className="border-slate-700 bg-slate-800/50 px-2.5 py-0.5 text-xs text-slate-400">
        {t("planFree")}
      </Badge>
      <Link
        href="/billing"
        className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
      >
        {t("upgrade")}
        <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
      <div className="flex w-full items-center justify-between px-4 md:px-6">
        <Breadcrumb />

        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
            <Bell className="h-4 w-4" />
          </button>

          <div className="hidden sm:block">
            <PlanBadge />
          </div>

          {hasClerk ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                  userButtonPopoverCard: "bg-slate-900 border-slate-800",
                },
              }}
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
              <UserCircle className="h-5 w-5 text-white" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
