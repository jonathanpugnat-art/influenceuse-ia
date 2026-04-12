"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { WizardProgress } from "@/components/influencer/wizard-progress";
import { WizardStepIdentity } from "@/components/influencer/wizard-step-identity";
import { WizardStepAppearance } from "@/components/influencer/wizard-step-appearance";
import { WizardStepSocial } from "@/components/influencer/wizard-step-social";
import { WizardStepSummary } from "@/components/influencer/wizard-step-summary";
import { useInfluencerWizard } from "@/hooks/use-influencer-wizard";

const stepTitles: Record<number, { title: string; subtitle: string }> = {
  1: {
    title: "Identité",
    subtitle: "Définis la personnalité et le positionnement de ton influenceuse",
  },
  2: {
    title: "Apparence",
    subtitle: "Personnalise le look et génère le visage de ton influenceuse",
  },
  3: {
    title: "Réseaux sociaux",
    subtitle: "Configure les plateformes sur lesquelles elle sera active",
  },
  4: {
    title: "Confirmation",
    subtitle: "Vérifie les informations et crée ton influenceuse",
  },
};

export default function NewInfluencerPage() {
  const { step, nextStep, prevStep, reset } = useInfluencerWizard();
  const directionRef = useRef<"forward" | "backward">("forward");

  // Reset wizard when mounting the page
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = () => {
    directionRef.current = "forward";
    nextStep();
  };

  const goPrev = () => {
    directionRef.current = "backward";
    prevStep();
  };

  const slideVariants = {
    enter: (direction: "forward" | "backward") => ({
      x: direction === "forward" ? 60 : -60,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: "forward" | "backward") => ({
      x: direction === "forward" ? -60 : 60,
      opacity: 0,
    }),
  };

  const info = stepTitles[step];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Back link */}
      <Link
        href="/influencers"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Mes Influenceuses
      </Link>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Nouvelle influenceuse
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Crée une influenceuse IA en 4 étapes
        </p>
      </div>

      {/* Progress bar */}
      <WizardProgress currentStep={step} />

      {/* Step title */}
      <div className="text-center">
        <h2 className="text-lg font-semibold text-white">{info.title}</h2>
        <p className="mt-1 text-sm text-slate-400">{info.subtitle}</p>
      </div>

      {/* Step content with animation */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait" custom={directionRef.current}>
          <motion.div
            key={step}
            custom={directionRef.current}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              type: "spring" as const,
              bounce: 0.1,
              duration: 0.4,
            }}
          >
            {step === 1 && <WizardStepIdentity onNext={goNext} />}
            {step === 2 && (
              <WizardStepAppearance onNext={goNext} onPrev={goPrev} />
            )}
            {step === 3 && (
              <WizardStepSocial onNext={goNext} onPrev={goPrev} />
            )}
            {step === 4 && <WizardStepSummary onPrev={goPrev} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
