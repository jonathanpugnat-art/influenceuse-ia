"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  FolderOpen,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as AudioIcon,
  Sparkles,
  Search,
  Filter,
  Trash2,
  Tag as TagIcon,
  Plus,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type MediaKind = "IMAGE" | "VIDEO" | "AUDIO" | "PRESET";

const KIND_META: Record<MediaKind, { icon: typeof ImageIcon; gradient: string }> = {
  IMAGE: { icon: ImageIcon, gradient: "from-violet-500 to-fuchsia-500" },
  VIDEO: { icon: VideoIcon, gradient: "from-rose-500 to-orange-500" },
  AUDIO: { icon: AudioIcon, gradient: "from-amber-500 to-yellow-500" },
  PRESET: { icon: Sparkles, gradient: "from-cyan-500 to-emerald-500" },
};

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export default function LibraryPage() {
  const t = useTranslations("library");
  const [kind, setKind] = useState<MediaKind | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input — avoids spamming the server.
  useMemo(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = trpc.mediaLibrary.list.useQuery({
    kind,
    search: debouncedSearch || undefined,
    limit: 100,
  });
  const stats = trpc.mediaLibrary.stats.useQuery();
  const utils = trpc.useUtils();

  const removeMutation = trpc.mediaLibrary.delete.useMutation({
    onSuccess: () => {
      toast.success(t("deleted"));
      utils.mediaLibrary.list.invalidate();
      utils.mediaLibrary.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleDelete = (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    removeMutation.mutate({ assetId: id });
  };

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
            <FolderOpen className="h-7 w-7 text-violet-400" />
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <UploadDialog
          onSuccess={() => {
            utils.mediaLibrary.list.invalidate();
            utils.mediaLibrary.stats.invalidate();
          }}
        />
      </header>

      <StatsCards stats={stats.data ?? []} loading={stats.isLoading} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          <FilterPill active={!kind} onClick={() => setKind(undefined)}>
            {t("filters.all")}
          </FilterPill>
          {(Object.keys(KIND_META) as MediaKind[]).map((k) => {
            const Icon = KIND_META[k].icon;
            return (
              <FilterPill key={k} active={kind === k} onClick={() => setKind(k)}>
                <Icon className="h-3.5 w-3.5" />
                {t(`kinds.${k}`)}
              </FilterPill>
            );
          })}
        </div>
      </div>

      {list.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      ) : list.data && list.data.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {list.data.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onDelete={() => handleDelete(asset.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState query={debouncedSearch} kind={kind} />
      )}
    </div>
  );
}

function StatsCards({
  stats,
  loading,
}: {
  stats: Array<{ kind: MediaKind; count: number; totalSize: number }>;
  loading: boolean;
}) {
  const t = useTranslations("library");
  const byKind = useMemo(() => {
    const map = new Map<MediaKind, { count: number; totalSize: number }>();
    for (const s of stats) map.set(s.kind, { count: s.count, totalSize: s.totalSize });
    return map;
  }, [stats]);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {(Object.keys(KIND_META) as MediaKind[]).map((k) => {
        const Icon = KIND_META[k].icon;
        const data = byKind.get(k) ?? { count: 0, totalSize: 0 };
        return (
          <div
            key={k}
            className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                  KIND_META[k].gradient
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t(`kinds.${k}`)}
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="text-2xl font-bold text-white">
                {data.count}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {formatBytes(data.totalSize)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FilterPill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-violet-500/50 bg-violet-500/10 text-white"
          : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
      )}
    >
      {children}
    </button>
  );
}

interface AssetData {
  id: string;
  name: string;
  kind: MediaKind;
  url: string;
  thumbnailUrl: string | null;
  tags: string[];
  sizeBytes: number | null;
  createdAt: Date;
}

function AssetCard({
  asset,
  onDelete,
}: {
  asset: AssetData;
  onDelete: () => void;
}) {
  const Icon = KIND_META[asset.kind].icon;
  const previewUrl = asset.thumbnailUrl ?? asset.url;
  const isVisual = asset.kind === "IMAGE" || asset.kind === "VIDEO";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40 transition-colors hover:border-slate-700">
      <div
        className={cn(
          "relative aspect-square overflow-hidden bg-gradient-to-br",
          KIND_META[asset.kind].gradient,
          "bg-opacity-10"
        )}
      >
        {isVisual && previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={asset.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon className="h-12 w-12 text-white/80" />
          </div>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete asset"
          className="absolute right-2 top-2 rounded-lg bg-black/70 p-1.5 text-slate-300 opacity-0 transition-opacity hover:bg-rose-500/90 hover:text-white group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3">
        <div className="mb-1 truncate text-sm font-medium text-white" title={asset.name}>
          {asset.name}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{formatBytes(asset.sizeBytes ?? 0)}</span>
          <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
        </div>
        {asset.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {asset.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-slate-800 text-[10px] text-slate-300"
              >
                <TagIcon className="mr-0.5 h-2.5 w-2.5" />
                {tag}
              </Badge>
            ))}
            {asset.tags.length > 3 && (
              <span className="text-[10px] text-slate-500">+{asset.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ query, kind }: { query: string; kind?: MediaKind }) {
  const t = useTranslations("library");
  const filtered = !!query || !!kind;
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
        <Filter className="h-7 w-7 text-violet-400" />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-white">
        {filtered ? t("emptyFiltered") : t("empty")}
      </h3>
      <p className="text-sm text-slate-400">
        {filtered ? t("emptyFilteredHint") : t("emptyHint")}
      </p>
    </div>
  );
}

function UploadDialog({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations("library.upload");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<MediaKind>("IMAGE");
  const [tags, setTags] = useState("");

  const addMutation = trpc.mediaLibrary.add.useMutation({
    onSuccess: () => {
      toast.success(t("success"));
      setOpen(false);
      setName("");
      setUrl("");
      setTags("");
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!name.trim() || !url.trim()) {
      toast.error(t("missingFields"));
      return;
    }
    addMutation.mutate({
      name: name.trim(),
      kind,
      url: url.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:opacity-90"
      >
        <Plus className="mr-1.5 h-4 w-4" />
        {t("cta")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">{t("name")}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">{t("url")}</label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">{t("kind")}</label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(KIND_META) as MediaKind[]).map((k) => (
                  <FilterPill
                    key={k}
                    active={kind === k}
                    onClick={() => setKind(k)}
                  >
                    {k}
                  </FilterPill>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                {t("tags")} <span className="text-slate-600">{t("tagsHint")}</span>
              </label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={submit} disabled={addMutation.isPending}>
              {addMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              {t("submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
