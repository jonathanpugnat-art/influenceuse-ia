import { describe, expect, it } from "vitest";
import {
  addUtcDays,
  startOfWeekMonday,
  toIsoDateUtc,
  WEEKLY_SLOT_DAYS,
  weeklySlotDate,
} from "@/lib/prompts/weekly-formats-prompts";

describe("weekly-formats-prompts helpers", () => {
  it("startOfWeekMonday returns Monday UTC for a Wednesday", () => {
    const wed = new Date("2026-07-15T15:30:00.000Z"); // Wed
    expect(toIsoDateUtc(startOfWeekMonday(wed))).toBe("2026-07-13");
  });

  it("startOfWeekMonday returns Monday UTC for a Sunday", () => {
    const sun = new Date("2026-07-19T12:00:00.000Z");
    expect(toIsoDateUtc(startOfWeekMonday(sun))).toBe("2026-07-13");
  });

  it("week window is Mon→Sun", () => {
    const mon = startOfWeekMonday(new Date("2026-07-15T00:00:00.000Z"));
    expect(toIsoDateUtc(mon)).toBe("2026-07-13");
    expect(toIsoDateUtc(addUtcDays(mon, 6))).toBe("2026-07-19");
  });

  it("default slots are Mon / Wed / Fri", () => {
    expect(WEEKLY_SLOT_DAYS).toEqual(["mon", "wed", "fri"]);
  });

  it("weeklySlotDate maps dayHint onto weekStart", () => {
    expect(toIsoDateUtc(weeklySlotDate("2026-07-13", "mon"))).toBe(
      "2026-07-13"
    );
    expect(toIsoDateUtc(weeklySlotDate("2026-07-13", "wed"))).toBe(
      "2026-07-15"
    );
    expect(toIsoDateUtc(weeklySlotDate("2026-07-13", "fri"))).toBe(
      "2026-07-17"
    );
  });

  it("spans 5 weeks of Mon slots for a 30-day plan window", () => {
    const mon = startOfWeekMonday(new Date("2026-07-15T00:00:00.000Z"));
    const dates = [0, 1, 2, 3, 4].map((w) =>
      toIsoDateUtc(weeklySlotDate(toIsoDateUtc(addUtcDays(mon, w * 7)), "mon"))
    );
    expect(dates).toEqual([
      "2026-07-13",
      "2026-07-20",
      "2026-07-27",
      "2026-08-03",
      "2026-08-10",
    ]);
  });
});
