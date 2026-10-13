import type { PackId, PlanId } from "@/lib/billing/plans";
import { isPackId, isPlanId } from "@/lib/billing/plans";

export type CheckoutSubscription = {
  kind: "subscription";
  plan: Exclude<PlanId, "decouverte">;
};

export type CheckoutPack = {
  kind: "pack";
  packId: PackId;
};

export type CheckoutBody = CheckoutSubscription | CheckoutPack;

export function parseCheckoutBody(
  body: unknown,
): { ok: true; value: CheckoutBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Requête illisible." };
  }
  const record = body as Record<string, unknown>;
  const kind = record.kind;

  switch (kind) {
    case "subscription": {
      const plan = typeof record.plan === "string" ? record.plan : "";
      if (!isPlanId(plan) || plan === "decouverte") {
        return { ok: false, error: "Plan invalide." };
      }
      return { ok: true, value: { kind: "subscription", plan } };
    }
    case "pack": {
      const packId = typeof record.packId === "string" ? record.packId : "";
      if (!isPackId(packId)) {
        return { ok: false, error: "Pack invalide." };
      }
      return { ok: true, value: { kind: "pack", packId } };
    }
    default:
      return { ok: false, error: "Type de checkout inconnu." };
  }
}
