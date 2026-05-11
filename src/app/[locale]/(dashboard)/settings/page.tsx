"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  User,
  Globe,
  Bell,
  Key,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WebhooksSection } from "@/components/settings/webhooks-section";
import { ApiKeysSection } from "@/components/settings/api-keys-section";
import { ReferralSection } from "@/components/settings/referral-section";

const UserProfileSection = dynamic(
  () =>
    import("@clerk/nextjs").then(({ useUser }) => {
      function Profile() {
        const { user } = useUser();
        if (!user) return <p className="text-sm text-slate-500">Chargement du profil...</p>;
        return (
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={user.imageUrl} alt={user.fullName ?? undefined} />
              <AvatarFallback className="bg-violet-500/20 text-violet-400">
                {user.firstName?.[0] ?? user.primaryEmailAddress?.emailAddress?.[0] ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-white">{user.fullName ?? "—"}</p>
              <p className="text-sm text-slate-400">{user.primaryEmailAddress?.emailAddress ?? "—"}</p>
            </div>
          </div>
        );
      }
      return { default: Profile };
    }),
  { ssr: false, loading: () => <p className="text-sm text-slate-500">Chargement du profil...</p> }
);

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [language, setLanguage] = useState("fr");
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [notifications, setNotifications] = useState({
    contentReady: true,
    publishSuccess: true,
    publishError: true,
    lowCredits: true,
  });
  const [showKeys, setShowKeys] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-400">
          Gérez votre profil et les préférences de l&apos;application.
        </p>
      </div>

      {/* Profile */}
      <Card className="border-slate-800/50 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <User className="h-5 w-5" />
            {t("profile")}
          </CardTitle>
          <CardDescription className="text-slate-400">
            Informations gérées par votre compte Clerk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserProfileSection />
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="border-slate-800/50 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Globe className="h-5 w-5" />
            {t("preferences")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-slate-300">{t("language")}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full max-w-xs border-slate-700 bg-slate-800/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">{t("timezone")}</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-full max-w-xs border-slate-700 bg-slate-800/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                <SelectItem value="America/New_York">America/New York</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">{t("dateFormat")}</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger className="w-full max-w-xs border-slate-700 bg-slate-800/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">JJ/MM/AAAA</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/JJ/AAAA</SelectItem>
                <SelectItem value="YYYY-MM-DD">AAAA-MM-JJ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-slate-800/50 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Bell className="h-5 w-5" />
            {t("notifications")}
          </CardTitle>
          <CardDescription className="text-slate-400">
            Choisissez les notifications par email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "contentReady" as const, label: t("contentReady") },
            { key: "publishSuccess" as const, label: t("publishSuccess") },
            { key: "publishError" as const, label: t("publishError") },
            { key: "lowCredits" as const, label: t("lowCredits") },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-slate-300">{label}</Label>
              <Switch
                checked={notifications[key]}
                onCheckedChange={(v) =>
                  setNotifications((prev) => ({ ...prev, [key]: v }))
                }
                className="data-[state=checked]:bg-violet-500"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card className="border-slate-800/50 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Key className="h-5 w-5" />
            {t("apiKeys")}
          </CardTitle>
          <CardDescription className="text-slate-400">
            Clés configurées via les variables d&apos;environnement (affichage masqué).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-400">Replicate / OpenAI</Label>
            <div className="flex items-center gap-2">
              <Input
                type={showKeys ? "text" : "password"}
                value={showKeys ? "sk-••••••••••••" : "••••••••••••••••"}
                readOnly
                className="max-w-md border-slate-700 bg-slate-800/50 font-mono text-slate-400"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-slate-700"
                onClick={() => setShowKeys((v) => !v)}
              >
                {showKeys ? t("hide") : t("show")}
              </Button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Pour modifier les clés, mettez à jour les variables d&apos;environnement du projet.
          </p>
        </CardContent>
      </Card>

      {/* Sprint 9 — Public API keys */}
      <ApiKeysSection />

      {/* Sprint 9 — Referral program */}
      <ReferralSection />

      {/* Webhooks (Phase 5 — outbound distribution) */}
      <WebhooksSection />

      {/* Danger Zone */}
      <Card className="border-red-500/20 bg-red-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            {t("dangerZone")}
          </CardTitle>
          <CardDescription className="text-slate-400">
            Actions irréversibles. Supprimer votre compte efface toutes vos données.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deleteAccount")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-slate-800 bg-slate-900">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
                  {t("deleteAccount")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">
                  {t("deleteAccountConfirm")}
                  <br />
                  {t("deleteAccountConfirm2")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Input
                  placeholder="SUPPRIMER"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-slate-700 text-slate-300">
                  {tCommon("cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleteConfirm !== "SUPPRIMER"}
                  className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {t("deleteAccount")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </motion.div>
  );
}
