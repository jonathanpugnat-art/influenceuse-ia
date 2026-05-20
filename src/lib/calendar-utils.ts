import type { CalendarEvent } from "@/components/calendar/types";

/** Filter calendar events to a single influencer (profile tab). */
export function filterCalendarEventsByInfluencer(
  events: CalendarEvent[],
  influencerId: string
): CalendarEvent[] {
  return events.filter((e) => e.influencer.id === influencerId);
}
