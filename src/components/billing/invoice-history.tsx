"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileText, ExternalLink, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, { label: string; className: string }> = {
  paid: { label: "Payée", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  open: { label: "En attente", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  draft: { label: "Brouillon", className: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  void: { label: "Annulée", className: "bg-red-500/10 text-red-400 border-red-500/20" },
  uncollectible: { label: "Impayée", className: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export function InvoiceHistory() {
  const { data, isLoading } = trpc.billing.getInvoices.useQuery();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6">
        <Skeleton className="h-6 w-40 bg-slate-800/50" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-slate-800/50" />
          ))}
        </div>
      </div>
    );
  }

  const invoices = data?.invoices ?? [];

  return (
    <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 backdrop-blur-xl">
      <h2 className="text-lg font-semibold text-white">Historique des factures</h2>

      {invoices.length === 0 ? (
        <div className="mt-6 flex flex-col items-center py-8">
          <Receipt className="h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">Aucune facture pour l&apos;instant</p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800/50">
                <th className="pb-3 text-left text-xs font-medium text-slate-500">Date</th>
                <th className="pb-3 text-left text-xs font-medium text-slate-500">Description</th>
                <th className="pb-3 text-right text-xs font-medium text-slate-500">Montant</th>
                <th className="pb-3 text-center text-xs font-medium text-slate-500">Statut</th>
                <th className="pb-3 text-right text-xs font-medium text-slate-500"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const status = statusStyles[inv.status] ?? statusStyles.draft;
                return (
                  <tr key={inv.id} className="border-b border-slate-800/30">
                    <td className="py-3 text-sm text-slate-300">
                      {inv.date ? format(new Date(inv.date), "d MMM yyyy", { locale: fr }) : "—"}
                    </td>
                    <td className="py-3 text-sm text-slate-400">{inv.description}</td>
                    <td className="py-3 text-right text-sm font-medium text-white">
                      {inv.amount.toFixed(2)}€
                    </td>
                    <td className="py-3 text-center">
                      <Badge className={cn("border px-2 py-0 text-xs", status.className)}>
                        {status.label}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      {inv.pdfUrl && (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
                        >
                          <FileText className="h-3 w-3" />
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

