"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { WizardData } from "@/hooks/use-influencer-wizard";
import {
  ETHNICITY_KEYS,
  ETHNICITY_VALUES,
  FASHION_KEYS,
  FASHION_VALUES,
  HAIR_COLOR_EMOJI,
  HAIR_COLOR_KEYS,
  HAIR_COLOR_VALUES,
  HAIR_LENGTH_KEYS,
  HAIR_LENGTH_VALUES,
  HAIR_TEXTURE_KEYS,
  HAIR_TEXTURE_VALUES,
} from "./appearance-constants";

export function useAppearanceForm({
  data,
  updateData,
}: {
  data: WizardData;
  updateData: (patch: Partial<WizardData>) => void;
}) {
  const t = useTranslations("wizard");

  const ethnicities = useMemo(
    () =>
      ETHNICITY_VALUES.map((value, i) => ({
        value,
        label: t(`ethnicityOptions.${ETHNICITY_KEYS[i]}`),
      })),
    [t]
  );

  const hairColors = useMemo(
    () =>
      HAIR_COLOR_VALUES.map((value, i) => ({
        value,
        emoji: HAIR_COLOR_EMOJI[i],
        label: t(`hairColorOptions.${HAIR_COLOR_KEYS[i]}`),
      })),
    [t]
  );

  const hairLengths = useMemo(
    () =>
      HAIR_LENGTH_VALUES.map((value, i) => ({
        value,
        label: t(`hairLengthOptions.${HAIR_LENGTH_KEYS[i]}`),
      })),
    [t]
  );

  const hairTextures = useMemo(
    () =>
      HAIR_TEXTURE_VALUES.map((value, i) => ({
        value,
        label: t(`hairTextureOptions.${HAIR_TEXTURE_KEYS[i]}`),
      })),
    [t]
  );

  const fashionStylesList = useMemo(
    () =>
      FASHION_VALUES.map((value, i) => ({
        value,
        label: t(`fashionStyleOptions.${FASHION_KEYS[i]}`),
      })),
    [t]
  );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    face: true,
    hair: false,
    body: false,
    style: false,
  });
  const toggleSection = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const ethnicity = data.ethnicity;
  const hairColor = data.hairColor;
  const hairLength = data.hairLength;
  const hairTexture = data.hairTexture;
  const bodyType = data.bodyType;
  const fashionStyles = data.fashionStyles ?? [];

  const setEthnicity = (v: string) => updateData({ ethnicity: v });
  const setHairColor = (v: string) => updateData({ hairColor: v });
  const setHairLength = (v: string) => updateData({ hairLength: v });
  const setHairTexture = (v: string) => updateData({ hairTexture: v });
  const toggleFashion = (style: string) => {
    const next = fashionStyles.includes(style)
      ? fashionStyles.filter((s) => s !== style)
      : [...fashionStyles, style];
    updateData({ fashionStyles: next });
  };

  const hasAnyChoice = Boolean(
    ethnicity ||
      hairColor ||
      hairLength ||
      hairTexture ||
      bodyType ||
      fashionStyles.length > 0
  );

  const faceSummary = ethnicity || undefined;
  const hairSummary =
    [hairColor, hairLength, hairTexture].filter(Boolean).join(" · ") ||
    undefined;
  const bodySummary =
    [data.bodyType, data.skinTone, data.height].filter(Boolean).join(" · ") ||
    undefined;
  const styleSummary = fashionStyles.join(" · ") || undefined;

  return {
    ethnicities,
    hairColors,
    hairLengths,
    hairTextures,
    fashionStylesList,
    openSections,
    toggleSection,
    ethnicity,
    hairColor,
    hairLength,
    hairTexture,
    fashionStyles,
    setEthnicity,
    setHairColor,
    setHairLength,
    setHairTexture,
    toggleFashion,
    hasAnyChoice,
    faceSummary,
    hairSummary,
    bodySummary,
    styleSummary,
  };
}

export type AppearanceFormState = ReturnType<typeof useAppearanceForm>;
