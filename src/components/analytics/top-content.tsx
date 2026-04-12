"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ImageIcon, Film } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ContentItem = {
  id: string;
  type: string;
  platform: string;
  views: number;
  likes: number;
  engagement: number;
  thumbnailUrl?: string | null;
};

interface TopContentProps {
  items: ContentItem[];
}

const PLATFORM_LABELS: Record<string, string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  ONLYFANS: "OnlyFans",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("fr-FR");
}

export function TopContent({ items }: TopContentProps) {
  const list = items.slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Card className="border-slate-800/50 bg-slate-900/50 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-white">
            Top contenus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun contenu pour cette période.</p>
          ) : (
            list.map((item, i) => (
              <Link
                key={item.id}
                href={`/content?id=${item.id}`}
                className="flex items-center gap-3 rounded-lg border border-slate-800/50 bg-slate-800/30 p-3 transition-colors hover:border-slate-700 hover:bg-slate-800/50"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-800">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    item.type === "REEL" ? (
                      <Film className="h-5 w-5 text-slate-500" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-slate-500" />
                    )
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{item.type === "REEL" ? "Reel" : "Photo"}</span>
                    <span>·</span>
                    <span>{PLATFORM_LABELS[item.platform] ?? item.platform}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0 text-xs text-white">
                    <span>{formatNumber(item.views)} vues</span>
                    <span>{formatNumber(item.likes)} likes</span>
                    <span className="text-slate-400">{item.engagement.toFixed(1)}% eng.</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
