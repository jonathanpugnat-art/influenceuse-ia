"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { AlertTriangle, Save, Trash2, Archive } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface InfluencerData {
  id: string;
  name: string;
  bio: string;
  personality: string;
  niche: string;
  age: number;
  style: Record<string, string>;
  isNsfw: boolean;
}

const NICHES = [
  "FASHION",
  "FITNESS",
  "LIFESTYLE",
  "TRAVEL",
  "TECH",
  "GAMING",
  "ADULT",
  "FOOD",
] as const;

export function InfluencerSettings({
  influencer,
}: {
  influencer: InfluencerData;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: plan } = trpc.billing.getCurrentPlan.useQuery();
  const allowNsfw = plan?.features.hasNsfw ?? false;
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm({
    defaultValues: {
      name: influencer.name,
      bio: influencer.bio,
      personality: influencer.personality,
      age: influencer.age,
    },
  });

  const [niche, setNiche] = useState(influencer.niche);
  const [isNsfw, setIsNsfw] = useState(influencer.isNsfw);

  const updateMutation = trpc.influencer.update.useMutation({
    onSuccess: () => {
      toast.success("Influenceuse mise à jour !");
      utils.influencer.getById.invalidate({ id: influencer.id });
    },
    onError: (err) => toast.error(err.message),
  });

  const archiveMutation = trpc.influencer.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Influenceuse archivée");
      router.push("/influencers");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.influencer.delete.useMutation({
    onSuccess: () => {
      toast.success("Influenceuse supprimée");
      router.push("/influencers");
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = handleSubmit((data) => {
    updateMutation.mutate({
      id: influencer.id,
      ...data,
      niche: niche as (typeof NICHES)[number],
      isNsfw,
    });
  });

  return (
    <div className="space-y-8">
      {/* Edit form */}
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-white">
            Informations générales
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-300">Nom</Label>
              <Input
                {...register("name")}
                className="border-slate-800/50 bg-slate-800/30 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Âge</Label>
              <Input
                type="number"
                {...register("age", { valueAsNumber: true })}
                className="border-slate-800/50 bg-slate-800/30 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Niche</Label>
              <Select value={niche} onValueChange={setNiche}>
                <SelectTrigger className="border-slate-800/50 bg-slate-800/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900">
                  {NICHES.map((n) => (
                    <SelectItem
                      key={n}
                      value={n}
                      className="text-slate-300 focus:bg-slate-800 focus:text-white"
                    >
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {allowNsfw && (
              <div className="flex items-center justify-between rounded-xl border border-slate-800/50 bg-slate-800/20 p-4 sm:col-span-2">
                <div>
                  <Label className="text-slate-300">Mode NSFW (Premium)</Label>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Active le contenu suggestif / boudoir pour cette influenceuse.
                  </p>
                </div>
                <Switch checked={isNsfw} onCheckedChange={setIsNsfw} />
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2">
            <Label className="text-slate-300">Bio</Label>
            <Textarea
              {...register("bio")}
              rows={3}
              className="border-slate-800/50 bg-slate-800/30 text-white"
            />
          </div>

          <div className="mt-4 space-y-2">
            <Label className="text-slate-300">Personnalité</Label>
            <Textarea
              {...register("personality")}
              rows={3}
              className="border-slate-800/50 bg-slate-800/30 text-white"
            />
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={!isDirty || isSubmitting || updateMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Sauvegarder
            </button>
          </div>
        </div>
      </form>

      {/* Appearance */}
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl">
        <h3 className="text-lg font-semibold text-white">Apparence</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(influencer.style).map(([key, value]) => (
            <div key={key} className="rounded-xl bg-slate-800/30 p-3">
              <p className="text-xs uppercase text-slate-500">{key}</p>
              <p className="mt-0.5 text-sm text-white">{value || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-red-400">
          <AlertTriangle className="h-5 w-5" />
          Zone de danger
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Ces actions sont irréversibles. Procédez avec précaution.
        </p>
        <Separator className="my-4 bg-red-500/10" />
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() =>
              archiveMutation.mutate({
                id: influencer.id,
                status: "ARCHIVED",
              })
            }
            disabled={archiveMutation.isPending}
            className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-400 transition-colors hover:bg-yellow-500/20"
          >
            <Archive className="h-4 w-4" />
            Archiver
          </button>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20">
                <Trash2 className="h-4 w-4" />
                Supprimer définitivement
              </button>
            </DialogTrigger>
            <DialogContent className="border-slate-800 bg-slate-900">
              <DialogHeader>
                <DialogTitle className="text-white">
                  Supprimer {influencer.name} ?
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Cette action est irréversible. L&apos;influenceuse et tout son
                  contenu seront définitivement supprimés.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <button
                  onClick={() => setDeleteOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  onClick={() => deleteMutation.mutate({ id: influencer.id })}
                  disabled={deleteMutation.isPending}
                  className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                >
                  Supprimer
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

