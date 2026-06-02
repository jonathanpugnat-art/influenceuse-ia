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
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setShowMore(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-slate-800/50 bg-slate-900 p-4 pb-8 md:hidden"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{t("more")}</h3>
                <button
                  type="button"
                  onClick={() => setShowMore(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
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
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-violet-500/10 text-violet-400"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
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

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/50 bg-slate-900 md:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {mainItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors",
                isActive(item.href) ? "text-violet-400" : "text-slate-500"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setShowMore(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors",
              isMoreActive ? "text-violet-400" : "text-slate-500"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-xs font-medium">{t("more")}</span>
          </button>
        </div>
        {/* Safe area padding for iPhone */}
        <div className="h-safe-area-bottom" />
      </nav>
    </>
  );
}
