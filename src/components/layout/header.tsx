"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { ChevronRight, ArrowUpRight, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { useInfluencers } from "@/hooks/use-influencers";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { contentSectionCrumbLabel } from "@/lib/nav-active";

const UserButton = dynamic(
  () => import("@clerk/nextjs").then((mod) => mod.UserButton),
  { ssr: false }
);

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function breadcrumbLabel(
  pathname: string,
  currentPath: string,
  segment: string,
  routeLabels: Record<string, string>,
  influencerNameById: Map<string, string>,
  labels: { createContent: string; library: string; edit: string }
): string {
  if (currentPath === "/content") {
    return contentSectionCrumbLabel(pathname, {
      createContent: labels.createContent,
      library: labels.library,
    });
  }

  const known = routeLabels[currentPath];
  if (known) return known;

  const influencerName = influencerNameById.get(segment);
  if (influencerName) return influencerName;

  if (segment === "edit") return labels.edit;
  if (/^c[a-z0-9]{20,}$/i.test(segment)) return "…";
  return decodeURIComponent(segment);
}

function Breadcrumb() {
  const pathname = usePathname();
  const t = useTranslations("layout");
  const tCommon = useTranslations("common");
  const segments = pathname.split("/").filter(Boolean);
  const { data } = useInfluencers(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );
  const influencerNameById = new Map(
    (data?.influencers ?? []).map((item) => [item.id, item.name])
  );

  const routeLabels: Record<string, string> = {
    "/": t("influencers"),
    "/influencers": t("influencers"),
    "/influencers/new": t("newInfluencer"),
    "/content/photo": t("photoCreator"),
    "/content/reel": t("reelCreator"),
    "/calendar": t("calendar"),
    "/analytics": t("analytics"),
    "/billing": t("billing"),
    "/settings": t("settings"),
    "/trends": t("trends"),
    "/library": t("library"),
  };

  if (segments.length === 0) {
    return <span className="text-lg font-semibold text-foreground">{t("dashboard")}</span>;
  }

  const crumbs: { label: string; href: string }[] = [];
  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    crumbs.push({
      label: breadcrumbLabel(
        pathname,
        currentPath,
        segment,
        routeLabels,
        influencerNameById,
        {
          createContent: t("createContent"),
          library: t("library"),
          edit: tCommon("edit"),
        }
      ),
      href: currentPath,
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      {crumbs.map((crumb, i) => (
        <div key={crumb.href} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
          <span
            className={cn(
              "text-sm",
              i === crumbs.length - 1
                ? "font-medium text-foreground"
                : "text-muted-foreground"
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
  const { data, isPending } = useCurrentPlan();
  const t = useTranslations("layout");

  if (isPending || !data) {
    return <div className="h-6 w-16 rounded-md bg-muted/40" aria-hidden />;
  }

  const plan = data.plan;

  switch (plan) {
    case "ENTERPRISE":
      return (
        <Badge className="border-border bg-foreground px-2.5 py-0.5 text-xs text-background">
          {t("planEnterprise")}
        </Badge>
      );
    case "PRO":
      return (
        <Badge className="border-primary/30 bg-foreground/10 px-2.5 py-0.5 text-xs text-foreground">
          {t("planPro")}
        </Badge>
      );
    case "STARTER":
      return (
        <Badge className="border-border bg-muted px-2.5 py-0.5 text-xs text-foreground">
          {t("planStarter")}
        </Badge>
      );
    case "FREE":
      return (
        <div className="flex items-center gap-2">
          <Badge className="border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {t("planFree")}
          </Badge>
          <Link
            href="/billing"
            className="flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-xs font-medium text-background transition-opacity hover:opacity-90"
          >
            {t("upgrade")}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      );
    default: {
      const _exhaustive: never = plan;
      return _exhaustive;
    }
  }
}

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border/30 bg-background/60 backdrop-blur-2xl">
      <div className="flex w-full items-center justify-between px-4 md:px-6">
        <Breadcrumb />

        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          <div className="hidden sm:block">
            <PlanBadge />
          </div>

          {hasClerk ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                  userButtonPopoverCard: "bg-popover border-border",
                },
              }}
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted">
              <UserCircle className="h-5 w-5 text-foreground" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
