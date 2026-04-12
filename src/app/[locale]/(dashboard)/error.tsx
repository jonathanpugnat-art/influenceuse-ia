"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <AlertCircle className="h-8 w-8 text-red-400" />
      </div>
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-white">
          Une erreur est survenue
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Nous n&apos;avons pas pu charger cette page. Vérifiez votre connexion
          et réessayez.
        </p>
      </div>
      <Button
        onClick={reset}
        variant="outline"
        className="border-slate-700 text-white hover:bg-slate-800"
      >
        Réessayer
      </Button>
    </div>
  );
}
