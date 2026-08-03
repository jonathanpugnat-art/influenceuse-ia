"use client";

import { Link, usePathname } from "@/i18n/navigation";
import {
  LayoutDashboard,
  ImagePlus,
  Calendar,
  MoreHorizontal,
  BarChart3,
  CreditCard,
  Settings,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const t = useTranslations("layout");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const mainItems = [
    { label: t("dashboard"), icon: LayoutDashboard, href: "/influencers" },
    { label: t("create"), icon: ImagePlus, href: "/content" },
    { label: t("calendar"), icon: Calendar, href: "/calendar" },
  ];

  const moreItems = [
    { label: t("analytics"), icon: BarChart3, href: "/analytics" },
    { label: t("billing"), icon: CreditCard, href: "/billing" },
    { label: t("settings"), icon: Settings, href: "/settings" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isMoreActive = moreItems.some((item) => isActive(item.href));

  return (
    <>
      {/* More drawer overlay */}
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden"
              onClick={() => setShowMore(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-border/50 bg-popover/95 p-4 pb-8 backdrop-blur-2xl md:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{t("more")}</h3>
                <button
                  type="button"
                  onClick={() => setShowMore(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label={tCommon("close")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                {moreItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom nav bar — floating pill */}
      <nav className="fixed bottom-4 left-4 right-4 z-40 rounded-full border border-border/50 bg-card/70 shadow-lg shadow-black/30 backdrop-blur-2xl pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        <div className="flex items-center justify-around px-2 py-2.5">
          {mainItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 transition-colors",
                isActive(item.href) ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setShowMore(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 transition-colors",
              isMoreActive ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-xs font-medium">{t("more")}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
