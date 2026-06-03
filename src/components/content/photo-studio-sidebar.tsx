"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  Dna,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { usePhotoCreator } from "@/hooks/use-photo-creator";
import { useCreatorExpertMode } from "@/hooks/use-creator-expert-mode";
import { PhotoParams } from "@/components/content/photo-params";
import { PhotoStudioLooksSection } from "@/components/content/photo-studio-looks-section";
import { PhotoStudioOutfitSection } from "@/components/content/photo-studio-outfit-section";
import { PhotoStudioDetailSection } from "@/components/content/photo-studio-detail-section";
import { PhotoStudioSceneSection } from "@/components/content/photo-studio-scene-section";
import { type InfluencerGender } from "@/lib/photo-niche-defaults";
import { PLANS } from "@/lib/constants";
import { trpc } from "@/lib/trpc";

function Pillar({
  icon: Icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-slate-800/60 bg-slate-800/20 px-3 py-2.5 text-left transition-colors hover:bg-slate-800/40">
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <Icon className="h-4 w-4 text-violet-400" />
          {title}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-1 pb-1 pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function PhotoStudioSidebar() {
  const t = useTranslations("content");
  const { params, updateParams } = usePhotoCreator();
  const { expert, setExpert, hydrated } = useCreatorExpertMode("photo");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const planQuery = trpc.billing.getCurrentPlan.useQuery();
  const canSceneFirst = planQuery.data
    ? PLANS[planQuery.data.plan as keyof typeof PLANS].hasSceneFirstPipeline
    : false;

  const { data: influencersData } = trpc.influencer.getAll.useQuery(
    { limit: 50 },
    { placeholderData: (prev) => prev }
  );
  const influencers = influencersData?.influencers ?? [];
  const selected = influencers.find((i) => i.id === params.influencerId);
  const gender = (selected?.gender as InfluencerGender | undefined) ?? "female";
  const niche = selected?.niche ?? "";
  const portraitUrl =
    selected?.baseImageUrl?.trim() || selected?.avatarUrl?.trim() || null;
  const hasInfluencer = Boolean(params.influencerId);

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-slate-800/50 bg-slate-900/40">
      <div className="shrink-0 border-b border-slate-800/50 px-4 py-4">
        <h1 className="text-lg font-bold text-white">{t("studioTitle")}</h1>
        <p className="mt-0.5 text-xs text-slate-500">{t("studioSubtitleSimple")}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin">
        <Pillar icon={Dna} title={t("studioPillarWho")} defaultOpen>
          {influencers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-4 text-center">
              <Users className="mx-auto h-6 w-6 text-slate-600" />
              <p className="mt-2 text-xs text-slate-500">{t("createFirstInfluencer")}</p>
              <Link href="/influencers/new" className="mt-2 inline-block text-xs text-violet-400">
                {t("createLink")}
              </Link>
            </div>
          ) : (
            <Select
              value={params.influencerId}
              onValueChange={(v) => updateParams({ influencerId: v })}
            >
              <SelectTrigger className="h-10 border-slate-800/50 bg-slate-800/30 text-white">
                <SelectValue placeholder={t("selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent className="border-slate-800 bg-slate-900">
                {influencers.map((inf) => (
                  <SelectItem key={inf.id} value={inf.id} className="text-slate-300">
                    {inf.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selected && portraitUrl && (
            <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-2.5">
              <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg border border-violet-500/30">
                <Image src={portraitUrl} alt="" fill className="object-cover" unoptimized />
              </div>
              <p className="text-[11px] text-slate-400">{t("studioDnaLocked")}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/50 bg-slate-800/20 px-3 py-2">
            <Label className="text-xs text-slate-300">{t("faceReferenceLabel")}</Label>
            <Switch
              checked={params.useFaceReference}
              disabled={!portraitUrl || params.contentMode === "NSFW"}
              onCheckedChange={(v) =>
                updateParams({
                  useFaceReference: v,
                  sceneFirst: v ? params.sceneFirst : false,
                })
              }
            />
          </div>
        </Pillar>

        <PhotoStudioLooksSection gender={gender} disabled={!hasInfluencer} />

        <PhotoStudioOutfitSection
          niche={niche}
          gender={gender}
          disabled={!hasInfluencer}
        />

        <PhotoStudioDetailSection disabled={!hasInfluencer} />

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-slate-800/60 px-3 py-2.5 text-xs text-slate-400 hover:bg-slate-800/30">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t("studioAdvanced")}
            </span>
            {advancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3 rounded-xl border border-slate-800/40 bg-slate-950/50 p-2">
            {hydrated && (
              <button
                type="button"
                onClick={() => setExpert(!expert)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300"
              >
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                {expert ? t("studioExpertOff") : t("studioExpertOn")}
              </button>
            )}
            {canSceneFirst && params.contentMode === "SFW" && (
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="text-xs text-slate-400">{t("sceneFirstLabel")}</span>
                <Switch
                  checked={params.sceneFirst && params.useFaceReference}
                  disabled={!params.useFaceReference}
                  onCheckedChange={(v) => updateParams({ sceneFirst: v })}
                />
              </div>
            )}
            {expert && (
              <>
                <PhotoStudioSceneSection disabled={!hasInfluencer} />
                <div className="max-h-[50vh] overflow-y-auto scrollbar-thin">
                  <PhotoParams embeddedExpert />
                </div>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
