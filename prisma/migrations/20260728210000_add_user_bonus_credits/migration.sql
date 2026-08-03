-- Crédits acquis hors plan (packs one-shot, rewards referral), persistés pour
-- que les changements de plan recalculent creditsLimit = planLimit + bonusCredits
-- au lieu d'écraser les crédits achetés.
ALTER TABLE "User" ADD COLUMN "bonusCredits" DOUBLE PRECISION NOT NULL DEFAULT 0;
