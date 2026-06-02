"use client";

import { useCallback, useEffect, useState } from "react";

export type CreatorVariant = "photo" | "reel";

function storageKey(variant: CreatorVariant) {
  return `aura_creator_expert_${variant}`;
}

export function useCreatorExpertMode(variant: CreatorVariant) {
  const [expert, setExpertState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(variant));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate expert toggle from localStorage
      if (raw === "1") setExpertState(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [variant]);

  const setExpert = useCallback(
    (value: boolean) => {
      setExpertState(value);
      try {
        localStorage.setItem(storageKey(variant), value ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [variant]
  );

  const toggleExpert = useCallback(() => {
    setExpert(!expert);
  }, [expert, setExpert]);

  return { expert, setExpert, toggleExpert, hydrated };
}
