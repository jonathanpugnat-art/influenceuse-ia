"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { emitCreditsChanged } from "@/lib/hooks/use-credits";

export function CheckoutBanner() {
  const params = useSearchParams();
  const checkout = params.get("checkout");
  const reason = params.get("reason");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (reason === "insufficient") {
      setMessage("Solde insuffisant — choisis un pack ou un plan ci-dessous.");
      return;
    }
    if (checkout === "cancel") {
      setMessage("Paiement annulé.");
      return;
    }
    if (checkout !== "success") return;

    setMessage("Paiement reçu, crédits en cours d’ajout…");
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      emitCreditsChanged();
      void fetch("/api/credits", { cache: "no-store" })
        .then((r) => r.json())
        .then(() => {
          if (tries >= 10) {
            window.clearInterval(timer);
            setMessage("Paiement reçu. Si le solde n’a pas bougé, rafraîchis dans un instant.");
          }
        })
        .catch(() => undefined);
    }, 2000);

    return () => window.clearInterval(timer);
  }, [checkout, reason]);

  if (!message) return null;
  return (
    <div className="mb-6 rounded-sm border border-line bg-raise px-4 py-3 text-sm text-mute">
      {message}
    </div>
  );
}
