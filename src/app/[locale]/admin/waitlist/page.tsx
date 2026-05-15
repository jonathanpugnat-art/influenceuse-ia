"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Check, X, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Admin-only waitlist dashboard. Access is gated server-side by the
 * `requireAdmin(ctx.userId)` call inside `adminRouter` — any non-admin
 * who lands here just sees empty results / FORBIDDEN errors from tRPC.
 *
 * Surface:
 *   - 3 stat counters (pending / invited / signed-up)
 *   - Status filter pills + search box
 *   - Table with email, name, source, created date, action buttons
 *   - "Invite" button: triggers Clerk invitation email + flips status
 *   - "Reject" button: marks as REJECTED (kept in DB for dedupe)
 *
 * No pagination UI yet (cursor exists in the API): under 1000 waitlist
 * entries fits on a single load, and we'll add lazy load when needed.
 */
export default function AdminWaitlistPage() {
  const [status, setStatus] = useState<
    "ALL" | "PENDING" | "INVITED" | "SIGNED_UP" | "REJECTED"
  >("PENDING");
  const [search, setSearch] = useState("");

  const listQuery = trpc.admin.listWaitlist.useQuery({
    status: status === "ALL" ? undefined : status,
    search: search.trim() || undefined,
    limit: 100,
  });

  const inviteMutation = trpc.admin.inviteFromWaitlist.useMutation({
    onSuccess: () => {
      toast.success("Invitation envoyée");
      void listQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.admin.rejectFromWaitlist.useMutation({
    onSuccess: () => {
      toast.success("Entrée rejetée");
      void listQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const stats = listQuery.data?.stats;
  const items = listQuery.data?.items ?? [];

  // tRPC FORBIDDEN comes through as an error on the query — we surface a
  // clear access-denied screen instead of a flash of empty results.
  if (listQuery.error?.data?.code === "FORBIDDEN") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold text-white">Accès refusé</h1>
          <p className="text-zinc-400 text-sm">
            Cette page est réservée aux administrateurs. Si vous pensez que
            c&apos;est une erreur, ajoutez votre email à la variable
            <code className="mx-1 px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-xs">
              ADMIN_EMAILS
            </code>
            puis reconnectez-vous.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="container mx-auto px-6 py-10 max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="size-7 text-violet-400" />
            Waitlist
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Gestion des inscriptions à la bêta privée.
          </p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "En attente", value: stats?.pending ?? 0, color: "text-amber-300" },
            { label: "Invités", value: stats?.invited ?? 0, color: "text-violet-300" },
            { label: "Inscrits", value: stats?.signedUp ?? 0, color: "text-emerald-300" },
            { label: "Total", value: stats?.total ?? 0, color: "text-white" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-zinc-500 mt-1 uppercase tracking-wider">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {(["PENDING", "INVITED", "SIGNED_UP", "REJECTED", "ALL"] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    status === s
                      ? "bg-violet-500 text-white"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              )
            )}
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Email ou nom…"
              className="pl-9 h-9 bg-zinc-900 border-zinc-800 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
          {listQuery.isLoading ? (
            <div className="p-10 text-center text-zinc-500 flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Chargement…
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-zinc-500 text-sm">
              Aucune entrée pour ce filtre.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">
                    Nom
                  </th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Statut</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {items.map((it) => (
                  <tr key={it.id} className="text-sm hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-mono text-zinc-200 text-xs md:text-sm">
                      {it.email}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">
                      {it.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 hidden md:table-cell text-xs">
                      {it.source ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell text-xs">
                      {new Date(it.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={it.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {it.status === "PENDING" && (
                        <div className="inline-flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={inviteMutation.isPending}
                            onClick={() =>
                              inviteMutation.mutate({ entryId: it.id })
                            }
                            className="h-7 px-2 text-violet-300 hover:bg-violet-500/10"
                          >
                            <Send className="size-3.5 mr-1" />
                            Inviter
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={rejectMutation.isPending}
                            onClick={() =>
                              rejectMutation.mutate({ entryId: it.id })
                            }
                            className="h-7 px-2 text-zinc-500 hover:bg-zinc-800"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    INVITED: "bg-violet-500/10 text-violet-300 border-violet-500/30",
    SIGNED_UP: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    REJECTED: "bg-zinc-700/40 text-zinc-400 border-zinc-700",
  };
  const icons: Record<string, React.ReactNode> = {
    INVITED: <Send className="size-3" />,
    SIGNED_UP: <Check className="size-3" />,
    REJECTED: <X className="size-3" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
        styles[status] ?? styles.PENDING
      }`}
    >
      {icons[status]}
      {status.replace("_", " ")}
    </span>
  );
}
