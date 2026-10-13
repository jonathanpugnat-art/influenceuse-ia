"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import { IconChart, IconChat, IconFaces, IconSpark, IconTrend } from "@/components/icons";
import { motion, useReducedMotion } from "@/components/motion";
import { duration, easeInOut } from "@/lib/motion";

type Tab = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

const TABS: readonly Tab[] = [
  { href: "/", label: "Influenceuses", icon: IconFaces },
  { href: "/tendances", label: "Tendances", icon: IconTrend },
  { href: "/contenu", label: "Contenu", icon: IconSpark },
  { href: "/chatter", label: "Chatter", icon: IconChat },
  { href: "/analytique", label: "Analytique", icon: IconChart },
];

function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") {
    return (
      pathname === "/" ||
      pathname === "/creer" ||
      (pathname.startsWith("/personnages/") && !pathname.endsWith("/contenu"))
    );
  }
  if (href === "/contenu") {
    return pathname === "/contenu" || pathname.endsWith("/contenu");
  }
  return pathname === href;
}

export function AppTabs() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav aria-label="Sections" className="flex gap-0.5 overflow-x-auto md:flex-col md:overflow-visible">
      {TABS.map((tab) => {
        const active = isCurrent(tab.href, pathname);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`shift ring-focus relative flex shrink-0 items-center gap-2.5 px-2.5 py-2 text-[0.6875rem] ${
              active ? "text-ink" : "text-mute hover:bg-raise/60 hover:text-ink"
            }`}
          >
            {active ? (
              reduce ? (
                <span className="absolute inset-0 border-l-2 border-lime bg-lime-soft" />
              ) : (
                <motion.span
                  layoutId="section-signal"
                  className="absolute inset-0 border-l-2 border-lime bg-lime-soft"
                  transition={{ duration: duration.ui, ease: easeInOut }}
                />
              )
            ) : null}
            <Icon size={16} className={`relative ${active ? "text-lime" : "text-dim"}`} />
            <span className="telemetry relative whitespace-nowrap">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
