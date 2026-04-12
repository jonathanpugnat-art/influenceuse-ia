export interface CalendarEvent {
  id: string;
  type: string;
  status: string;
  date: string;
  platforms: string[];
  thumbnailUrl: string | null;
  caption: string | null;
  hashtags: string[];
  mediaUrls: string[];
  influencer: {
    id: string;
    name: string;
    slug: string;
    niche: string;
    avatarUrl: string | null;
  };
}

export type CalendarView = "month" | "week" | "list";

