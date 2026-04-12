export const nicheConfig: Record<
  string,
  { label: string; text: string; bg: string }
> = {
  FASHION: {
    label: "Fashion",
    text: "text-pink-400",
    bg: "bg-pink-500/10 border-pink-500/20",
  },
  FITNESS: {
    label: "Fitness",
    text: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  LIFESTYLE: {
    label: "Lifestyle",
    text: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  TRAVEL: {
    label: "Travel",
    text: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  TECH: {
    label: "Tech",
    text: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
  GAMING: {
    label: "Gaming",
    text: "text-indigo-400",
    bg: "bg-indigo-500/10 border-indigo-500/20",
  },
  ADULT: {
    label: "Adult",
    text: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
  FOOD: {
    label: "Food",
    text: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
};

export const statusConfig: Record<
  string,
  { label: string; text: string; bg: string }
> = {
  ACTIVE: {
    label: "Active",
    text: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  PAUSED: {
    label: "En pause",
    text: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
  },
  ARCHIVED: {
    label: "Archivée",
    text: "text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
  },
};

export function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

