import { describe, it, expect } from "vitest";
import { filterCalendarEventsByInfluencer } from "@/lib/calendar-utils";
import type { CalendarEvent } from "@/components/calendar/types";

function mockEvent(influencerId: string, id = "c1"): CalendarEvent {
  return {
    id,
    type: "PHOTO",
    status: "SCHEDULED",
    date: new Date().toISOString(),
    platforms: ["INSTAGRAM"],
    thumbnailUrl: null,
    caption: null,
    hashtags: [],
    mediaUrls: [],
    influencer: {
      id: influencerId,
      name: "Test",
      slug: "test",
      niche: "FASHION",
      avatarUrl: null,
    },
  };
}

describe("filterCalendarEventsByInfluencer", () => {
  it("keeps only events for the given influencer", () => {
    const events = [mockEvent("a", "1"), mockEvent("b", "2"), mockEvent("a", "3")];
    const filtered = filterCalendarEventsByInfluencer(events, "a");
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.influencer.id === "a")).toBe(true);
  });

  it("returns empty array when no match", () => {
    expect(filterCalendarEventsByInfluencer([mockEvent("b")], "a")).toEqual([]);
  });
});
