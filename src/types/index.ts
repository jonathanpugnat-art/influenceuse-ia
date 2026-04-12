// Shared types
// TODO: Définir les types partagés de l'application

export type Plan = "FREE" | "PRO" | "ENTERPRISE";

export interface UserCredits {
  total: number;
  used: number;
  remaining: number;
}

export interface Influencer {
  id: string;
  name: string;
  slug: string;
  description: string;
  style: string;
  createdAt: Date;
  updatedAt: Date;
}

