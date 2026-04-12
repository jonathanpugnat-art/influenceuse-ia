"use client";

import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  MoreHorizontal,
  Eye,
  ImagePlus,
  Pause,
  Play,
  Archive,
  ArrowUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TikTokIcon,
  InstagramIcon,
  OnlyFansIcon,
} from "@/components/ui/social-icons";
import { cn } from "@/lib/utils";
import {
  nicheConfig,
  statusConfig,
  formatFollowers,
} from "@/lib/influencer-utils";
import type { InfluencerCardData } from "./influencer-card";

const columnHelper = createColumnHelper<InfluencerCardData>();

function getSocial(inf: InfluencerCardData, platform: string) {
  return inf.socialAccounts.find((s) => s.platform === platform);
}

export function InfluencerTable({
  influencers,
  onStatusChange,
}: {
  influencers: InfluencerCardData[];
  onStatusChange?: (id: string, status: string) => void;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = [
    columnHelper.accessor("name", {
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 text-slate-400 hover:text-white"
          onClick={() => column.toggleSorting()}
        >
          Influenceuse
          <ArrowUpDown className="h-3 w-3" />
        </button>
      ),
      cell: ({ row }) => {
        const inf = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 shrink-0">
              <div className="absolute -inset-0.5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 opacity-50" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
                {inf.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={inf.avatarUrl}
                    alt={inf.name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  inf.name.charAt(0)
                )}
              </div>
            </div>
            <span className="font-medium text-white">{inf.name}</span>
          </div>
        );
      },
    }),
    columnHelper.accessor("niche", {
      header: "Niche",
      cell: ({ getValue }) => {
        const c = nicheConfig[getValue()] ?? nicheConfig.FASHION;
        return (
          <Badge className={cn("border px-2 py-0 text-xs", c.bg, c.text)}>
            {c.label}
          </Badge>
        );
      },
    }),
    columnHelper.accessor("status", {
      header: "Statut",
      cell: ({ getValue }) => {
        const c = statusConfig[getValue()] ?? statusConfig.ACTIVE;
        return (
          <Badge className={cn("border px-2 py-0 text-xs", c.bg, c.text)}>
            {c.label}
          </Badge>
        );
      },
    }),
    columnHelper.display({
      id: "instagram",
      header: () => <InstagramIcon className="h-4 w-4 text-pink-400" />,
      cell: ({ row }) => {
        const s = getSocial(row.original, "INSTAGRAM");
        return (
          <span className={cn("text-sm", s ? "text-slate-300" : "text-slate-600")}>
            {s ? formatFollowers(s.followers) : "—"}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: "tiktok",
      header: () => <TikTokIcon className="h-4 w-4 text-white" />,
      cell: ({ row }) => {
        const s = getSocial(row.original, "TIKTOK");
        return (
          <span className={cn("text-sm", s ? "text-slate-300" : "text-slate-600")}>
            {s ? formatFollowers(s.followers) : "—"}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: "onlyfans",
      header: () => <OnlyFansIcon className="h-4 w-4 text-blue-400" />,
      cell: ({ row }) => {
        const s = getSocial(row.original, "ONLYFANS");
        return (
          <span className={cn("text-sm", s ? "text-slate-300" : "text-slate-600")}>
            {s ? formatFollowers(s.followers) : "—"}
          </span>
        );
      },
    }),
    columnHelper.accessor((r) => r._count.contents, {
      id: "contents",
      header: ({ column }) => (
        <button
          className="flex items-center gap-1 text-slate-400 hover:text-white"
          onClick={() => column.toggleSorting()}
        >
          Contenus
          <ArrowUpDown className="h-3 w-3" />
        </button>
      ),
      cell: ({ getValue }) => (
        <span className="text-sm text-slate-300">{getValue()}</span>
      ),
    }),
    columnHelper.accessor((r) => r.analytics?.avgEngagement ?? 0, {
      id: "engagement",
      header: "Engagement",
      cell: ({ getValue }) => (
        <span className="text-sm text-slate-300">{getValue().toFixed(1)}%</span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => {
        const inf = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 border-slate-800 bg-slate-900"
            >
              <DropdownMenuItem
                onClick={() => router.push(`/influencers/${inf.id}`)}
                className="text-slate-300 focus:bg-slate-800 focus:text-white"
              >
                <Eye className="mr-2 h-4 w-4" />
                Voir
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/content?influencer=${inf.id}`)
                }
                className="text-slate-300 focus:bg-slate-800 focus:text-white"
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Créer du contenu
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-800" />
              {inf.status === "ACTIVE" ? (
                <DropdownMenuItem
                  onClick={() => onStatusChange?.(inf.id, "PAUSED")}
                  className="text-yellow-400 focus:bg-slate-800 focus:text-yellow-300"
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Mettre en pause
                </DropdownMenuItem>
              ) : inf.status === "PAUSED" ? (
                <DropdownMenuItem
                  onClick={() => onStatusChange?.(inf.id, "ACTIVE")}
                  className="text-emerald-400 focus:bg-slate-800 focus:text-emerald-300"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Réactiver
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() => onStatusChange?.(inf.id, "ARCHIVED")}
                className="text-red-400 focus:bg-slate-800 focus:text-red-300"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archiver
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: influencers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-xl">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-slate-800/50">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium text-slate-500"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() =>
                  router.push(`/influencers/${row.original.id}`)
                }
                className="cursor-pointer border-b border-slate-800/30 transition-colors hover:bg-slate-800/30"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

