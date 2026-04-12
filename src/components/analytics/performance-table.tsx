"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ImageIcon, Film, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  influencerName: string;
  type: string;
  platform: string;
  date: Date | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  thumbnailUrl?: string | null;
};

interface PerformanceTableProps {
  rows: Row[];
  total: number;
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onPageChange: (page: number) => void;
  onSort: (sortBy: string, sortOrder: "asc" | "desc") => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  ONLYFANS: "OnlyFans",
};

function formatNumber(n: number): string {
  return n.toLocaleString("fr-FR");
}

function SortHeader({
  label,
  sortKey,
  currentSortBy,
  currentSortOrder,
  onSort,
}: {
  label: string;
  sortKey: string;
  currentSortBy?: string;
  currentSortOrder?: "asc" | "desc";
  onSort: (sortBy: string, sortOrder: "asc" | "desc") => void;
}) {
  const isActive = currentSortBy === sortKey;
  const nextOrder =
    isActive && currentSortOrder === "desc" ? "asc" : "desc";
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey, nextOrder)}
      className="flex items-center gap-1 font-medium text-white hover:text-slate-300"
    >
      {label}
      {isActive ? (
        currentSortOrder === "desc" ? (
          <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUp className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
      )}
    </button>
  );
}

export function PerformanceTable({
  rows,
  total,
  page,
  limit,
  sortBy,
  sortOrder,
  onPageChange,
  onSort,
}: PerformanceTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-2xl border border-slate-800/50 bg-slate-900/50 overflow-hidden backdrop-blur-xl"
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800/50 hover:bg-transparent">
              <TableHead className="text-slate-400 w-[80px]">Miniature</TableHead>
              <TableHead className="text-slate-400">
                <SortHeader
                  label="Influenceuse"
                  sortKey="influencerName"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className="text-slate-400">
                <SortHeader
                  label="Type"
                  sortKey="type"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className="text-slate-400">Plateforme</TableHead>
              <TableHead className="text-slate-400">
                <SortHeader
                  label="Date"
                  sortKey="date"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className="text-slate-400 text-right">
                <SortHeader
                  label="Vues"
                  sortKey="views"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className="text-slate-400 text-right">
                <SortHeader
                  label="Likes"
                  sortKey="likes"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                />
              </TableHead>
              <TableHead className="text-slate-400 text-right">Commentaires</TableHead>
              <TableHead className="text-slate-400 text-right">Partages</TableHead>
              <TableHead className="text-slate-400 text-right">
                <SortHeader
                  label="Engagement"
                  sortKey="engagement"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="border-slate-800/50 hover:bg-slate-800/30"
              >
                <TableCell className="w-[80px]">
                  <Link
                    href={`/content?id=${row.id}`}
                    className="block flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-slate-800 hover:ring-2 hover:ring-slate-600"
                  >
                    {row.thumbnailUrl ? (
                      <img
                        src={row.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : row.type === "REEL" ? (
                      <Film className="h-5 w-5 text-slate-500" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-slate-500" />
                    )}
                  </Link>
                </TableCell>
                <TableCell className="font-medium text-white">
                  {row.influencerName}
                </TableCell>
                <TableCell className="text-slate-300">{row.type}</TableCell>
                <TableCell className="text-slate-300">
                  {PLATFORM_LABELS[row.platform] ?? row.platform}
                </TableCell>
                <TableCell className="text-slate-400 text-sm">
                  {row.date
                    ? new Date(row.date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </TableCell>
                <TableCell className="text-right text-slate-300">
                  {formatNumber(row.views)}
                </TableCell>
                <TableCell className="text-right text-slate-300">
                  {formatNumber(row.likes)}
                </TableCell>
                <TableCell className="text-right text-slate-400">
                  {formatNumber(row.comments)}
                </TableCell>
                <TableCell className="text-right text-slate-400">
                  {formatNumber(row.shares)}
                </TableCell>
                <TableCell className="text-right font-medium text-white">
                  {row.engagement.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/50 px-4 py-3">
        <p className="text-sm text-slate-500">
          {start}–{end} sur {total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Suivant
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
