import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-800/50 bg-slate-900/50 p-6 md:p-8">
        <Skeleton className="mb-2 h-5 w-24 bg-slate-800/50" />
        <Skeleton className="h-9 w-64 bg-slate-800/50" />
        <Skeleton className="mt-2 h-5 w-96 max-w-full bg-slate-800/50" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-[100px] rounded-2xl border border-slate-800/50 bg-slate-900/50"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Skeleton className="h-80 rounded-2xl border border-slate-800/50 bg-slate-900/50" />
        </div>
        <Skeleton className="h-80 rounded-2xl border border-slate-800/50 bg-slate-900/50" />
      </div>
      <Skeleton className="h-64 rounded-2xl border border-slate-800/50 bg-slate-900/50" />
    </div>
  );
}
