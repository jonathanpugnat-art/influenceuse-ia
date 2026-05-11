"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Code2, Copy, Check, Plus, Trash2, Power, PowerOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Scope = "READ" | "WRITE" | "ADMIN";

/**
 * Sprint 9 — API Keys section in /settings.
 *
 * Lists keys, lets the user create / revoke / delete them. Plain key is
 * shown ONCE in a banner immediately after creation — never again.
 */
export function ApiKeysSection() {
  const t = useTranslations("settings.apiKeysSection");
  const utils = trpc.useUtils();
  const { data: keys, isLoading } = trpc.apiKeys.list.useQuery();

  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(["READ"]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (key) => {
      setNewKey(key.plainKey);
      setName("");
      setScopes(["READ"]);
      utils.apiKeys.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const revokeMutation = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      utils.apiKeys.list.invalidate();
      toast.success(t("revoked"));
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.apiKeys.delete.useMutation({
    onSuccess: () => {
      utils.apiKeys.list.invalidate();
      toast.success(t("deleted"));
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleScope = (s: Scope) => {
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const copyKey = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-slate-800/50 bg-slate-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Code2 className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription className="text-slate-400">
          {t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* New key banner */}
        {newKey && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="mb-2 text-sm font-semibold text-emerald-300">
              {t("newKeyTitle")}
            </p>
            <p className="mb-3 text-xs text-slate-300">{t("newKeyWarning")}</p>
            <div className="flex items-center gap-2">
              <Input
                value={newKey}
                readOnly
                className="font-mono text-xs"
              />
              <Button size="sm" onClick={copyKey}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-slate-400"
              onClick={() => setNewKey(null)}
            >
              {t("close")}
            </Button>
          </div>
        )}

        {/* Create form */}
        <div className="space-y-3 rounded-lg border border-slate-800 p-4">
          <Label className="text-sm text-slate-300">{t("createTitle")}</Label>
          <Input
            placeholder={t("namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {(["READ", "WRITE", "ADMIN"] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleScope(s)}
                className={cn(
                  "rounded-md border px-3 py-1 text-xs font-medium uppercase transition-colors",
                  scopes.includes(s)
                    ? "border-violet-500 bg-violet-500/20 text-violet-200"
                    : "border-slate-700 bg-slate-800 text-slate-400"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            disabled={!name || !scopes.length || createMutation.isPending}
            onClick={() => createMutation.mutate({ name, scopes })}
          >
            <Plus className="mr-1 h-4 w-4" />
            {createMutation.isPending ? t("creating") : t("create")}
          </Button>
        </div>

        {/* Existing keys */}
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-xs text-slate-500">{t("loading")}</p>
          ) : !keys?.length ? (
            <p className="text-xs text-slate-500">{t("empty")}</p>
          ) : (
            keys.map((k) => (
              <div
                key={k.id}
                className={cn(
                  "flex items-center justify-between rounded-md border p-3",
                  k.isActive
                    ? "border-slate-800 bg-slate-900/40"
                    : "border-slate-800/40 bg-slate-900/20 opacity-60"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{k.name}</p>
                  <p className="font-mono text-xs text-slate-500">{k.prefix}••••</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                    {k.scopes.map((s) => (
                      <Badge
                        key={s}
                        variant="outline"
                        className="border-violet-500/30 bg-violet-500/10 text-violet-300"
                      >
                        {s}
                      </Badge>
                    ))}
                    {!k.isActive && (
                      <Badge variant="outline" className="border-red-500/30 text-red-400">
                        {t("revokedLabel")}
                      </Badge>
                    )}
                    {k.lastUsedAt && (
                      <span className="text-slate-500">
                        · {t("lastUsed")} {new Date(k.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {k.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeMutation.mutate({ keyId: k.id })}
                      title={t("revoke")}
                    >
                      <PowerOff className="h-3.5 w-3.5 text-amber-400" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate({ keyId: k.id })}
                    title={t("delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-slate-500">
          {t("docsHint")} <code className="text-violet-300">GET /api/public/v1/influencers</code>
        </p>
      </CardContent>
    </Card>
  );
}

// keep Power import used somewhere to avoid tree-shake noise; tiny no-op.
void Power;
