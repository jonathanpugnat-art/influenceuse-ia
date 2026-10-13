"use client";

import { useCallback, useEffect, useState } from "react";

import { CREDIT_COSTS, canAfford, type CreditKind } from "@/lib/credits";

export type CreditsState = {
  balance: number;
  plan: string;
  planName: string;
  enforced: boolean;
};

const CREDITS_EVENT = "ofmia:credits-changed";

export function emitCreditsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CREDITS_EVENT));
}

export function useCredits(kind: CreditKind = "post") {
  const [data, setData] = useState<CreditsState | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/credits", { cache: "no-store" });
      if (!response.ok) return;
      const json = (await response.json()) as { data?: CreditsState };
      if (json.data) setData(json.data);
    } catch {
      // badge optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const onFocus = () => void reload();
    const onCredits = () => void reload();
    window.addEventListener("focus", onFocus);
    window.addEventListener(CREDITS_EVENT, onCredits);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(CREDITS_EVENT, onCredits);
    };
  }, [reload]);

  const balance = data?.balance ?? 0;
  const enforced = data?.enforced ?? false;
  const cost = CREDIT_COSTS[kind];
  const affordable = canAfford(balance, cost, enforced);
  return {
    data,
    loading,
    balance,
    enforced,
    cost,
    affordable,
    reload,
  };
}
