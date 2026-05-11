"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Webhook as WebhookIcon, Plus, Send, Trash2, Copy, RefreshCw, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ALL_EVENTS = [
  "CONTENT_PUBLISHED",
  "CONTENT_FAILED",
  "BATCH_COMPLETED",
  "CONTENT_SCHEDULED",
] as const;

type WebhookEvent = (typeof ALL_EVENTS)[number];

/**
 * Outbound webhooks management section in /settings (Phase 5).
 *
 * Lets the user register HTTPS endpoints (Zapier, n8n, custom backend...) to
 * receive `content.published` / `content.failed` / `batch.completed` events.
 */
export function WebhooksSection() {
  const t = useTranslations("settings.webhooks");
  const utils = trpc.useUtils();

  const { data: webhooks, isLoading } = trpc.webhook.list.useQuery();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([
    "CONTENT_PUBLISHED",
  ]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [openDeliveriesId, setOpenDeliveriesId] = useState<string | null>(null);

  const createMut = trpc.webhook.create.useMutation({
    onSuccess: ({ secret }) => {
      toast.success(t("created"));
      setRevealedSecret(secret);
      setName("");
      setUrl("");
      setCreating(false);
      utils.webhook.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.webhook.update.useMutation({
    onSuccess: () => utils.webhook.list.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const rotateMut = trpc.webhook.rotateSecret.useMutation({
    onSuccess: ({ secret }) => {
      setRevealedSecret(secret);
      toast.success(t("rotated"));
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.webhook.delete.useMutation({
    onSuccess: () => {
      toast.success(t("deleted"));
      utils.webhook.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const pingMut = trpc.webhook.ping.useMutation({
    onSuccess: ({ status, responseCode }) => {
      if (status === "SUCCESS") toast.success(t("pingOk", { code: responseCode ?? "?" }));
      else toast.error(t("pingFailed", { code: responseCode ?? "—" }));
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleEvent = (ev: WebhookEvent) => {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  const submit = () => {
    if (!name.trim() || !url.trim() || selectedEvents.length === 0) {
      toast.error(t("missingFields"));
      return;
    }
    createMut.mutate({ name: name.trim(), url: url.trim(), events: selectedEvents });
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("copied"));
  };

  return (
    <Card className="border-slate-800/50 bg-slate-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <WebhookIcon className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription className="text-slate-400">{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Newly-revealed secret banner */}
        {revealedSecret && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="font-medium text-amber-200">{t("secretRevealed")}</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-slate-950/60 px-2 py-1 font-mono text-xs text-amber-100">
                {revealedSecret}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(revealedSecret)}
                className="border-amber-400/50"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRevealedSecret(null)}
              >
                {t("dismiss")}
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-200/80">{t("secretWarning")}</p>
          </div>
        )}

        {/* Existing webhooks list */}
        {isLoading ? (
          <p className="text-sm text-slate-500">{t("loading")}</p>
        ) : webhooks && webhooks.length > 0 ? (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <WebhookRow
                key={wh.id}
                wh={wh}
                isOpen={openDeliveriesId === wh.id}
                onToggleOpen={() =>
                  setOpenDeliveriesId(openDeliveriesId === wh.id ? null : wh.id)
                }
                onToggleActive={(v) =>
                  updateMut.mutate({ id: wh.id, isActive: v })
                }
                onPing={() => pingMut.mutate({ id: wh.id })}
                onRotate={() => rotateMut.mutate({ id: wh.id })}
                onDelete={() => deleteMut.mutate({ id: wh.id })}
                pinging={pingMut.isPending}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t("empty")}</p>
        )}

        {/* Create form */}
        {creating ? (
          <div className="space-y-3 rounded-xl border border-slate-800/50 bg-slate-950/30 p-4">
            <div className="space-y-1.5">
              <Label className="text-slate-400">{t("nameLabel")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400">{t("urlLabel")}</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hooks.example.com/influenceuse-ia"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400">{t("eventsLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((ev) => {
                  const active = selectedEvents.includes(ev);
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleEvent(ev)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "border-violet-500 bg-violet-500/20 text-violet-200"
                          : "border-slate-700 text-slate-400 hover:border-slate-600"
                      )}
                    >
                      {t(`events.${ev}`)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>
                {t("cancel")}
              </Button>
              <Button onClick={submit} disabled={createMut.isPending}>
                {createMut.isPending ? t("saving") : t("save")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addWebhook")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface WebhookRowProps {
  wh: {
    id: string;
    name: string;
    url: string;
    events: string[];
    isActive: boolean;
    failureCount: number;
    lastSuccessAt: Date | null;
    lastFailedAt: Date | null;
    deliveriesCount: number;
  };
  isOpen: boolean;
  onToggleOpen: () => void;
  onToggleActive: (v: boolean) => void;
  onPing: () => void;
  onRotate: () => void;
  onDelete: () => void;
  pinging: boolean;
}

function WebhookRow({
  wh,
  isOpen,
  onToggleOpen,
  onToggleActive,
  onPing,
  onRotate,
  onDelete,
  pinging,
}: WebhookRowProps) {
  const t = useTranslations("settings.webhooks");
  const { data: deliveries } = trpc.webhook.recentDeliveries.useQuery(
    { webhookId: wh.id, limit: 10 },
    { enabled: isOpen, refetchInterval: isOpen ? 5_000 : false }
  );

  return (
    <div className="rounded-xl border border-slate-800/50 bg-slate-950/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-white">{wh.name}</p>
            {wh.isActive ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                {t("active")}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-slate-700 text-slate-400">
                {t("paused")}
              </Badge>
            )}
            {wh.failureCount > 0 && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                {t("failures", { count: wh.failureCount })}
              </Badge>
            )}
          </div>
          <p className="mt-1 truncate font-mono text-xs text-slate-500">{wh.url}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {wh.events.map((e) => (
              <span
                key={e}
                className="rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300"
              >
                {t(`events.${e}`)}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Switch
            checked={wh.isActive}
            onCheckedChange={onToggleActive}
            className="data-[state=checked]:bg-violet-500"
            aria-label="active"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={onPing}
            disabled={pinging}
            title={t("ping")}
          >
            <Send className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onRotate} title={t("rotateSecret")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="text-red-400 hover:text-red-300"
            title={t("delete")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onToggleOpen}>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
            />
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 border-t border-slate-800/50 pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("recentDeliveries")}
          </p>
          {deliveries && deliveries.length > 0 ? (
            <div className="space-y-1">
              {deliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-900/40 px-2 py-1.5 text-xs"
                >
                  <span className="font-mono text-slate-400">
                    {t(`events.${d.event}`)}
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                      d.status === "SUCCESS"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : d.status === "RETRYING"
                        ? "bg-amber-500/20 text-amber-300"
                        : d.status === "FAILED"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-slate-700 text-slate-300"
                    )}
                  >
                    {d.status}
                    {d.responseCode ? ` · ${d.responseCode}` : ""}
                  </span>
                  <span className="text-slate-500">
                    {new Date(d.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">{t("noDeliveries")}</p>
          )}
        </div>
      )}
    </div>
  );
}

