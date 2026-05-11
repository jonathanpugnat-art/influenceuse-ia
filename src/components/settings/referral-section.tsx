"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Gift, Copy, Check, Users, Coins } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Sprint 9 — Referral program section in /settings.
 * Displays the user's code, share URL, and conversion stats.
 */
export function ReferralSection() {
  const t = useTranslations("settings.referral");
  const { data: code, isLoading } = trpc.referral.myCode.useQuery();
  const { data: stats } = trpc.referral.myStats.useQuery();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-slate-900/50 to-cyan-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Gift className="h-5 w-5 text-emerald-400" />
          {t("title")}
        </CardTitle>
        <CardDescription className="text-slate-400">
          {t("description", { credits: code?.rewardCredits ?? 50 })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !code ? (
          <p className="text-sm text-slate-500">{t("loading")}</p>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {t("yourCode")}
              </p>
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-lg font-bold text-emerald-200">
                {code.code}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                {t("shareUrl")}
              </p>
              <div className="flex items-center gap-2">
                <Input value={code.shareUrl} readOnly className="font-mono text-xs" />
                <Button size="sm" onClick={copy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <Stat
                icon={Users}
                label={t("invited")}
                value={stats?.total ?? 0}
                color="text-cyan-400"
              />
              <Stat
                icon={Users}
                label={t("converted")}
                value={stats?.converted ?? 0}
                color="text-violet-400"
              />
              <Stat
                icon={Coins}
                label={t("credits")}
                value={stats?.earnedCredits ?? 0}
                color="text-emerald-400"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Gift;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-center">
      <Icon className={`mx-auto mb-1 h-4 w-4 ${color}`} />
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}
