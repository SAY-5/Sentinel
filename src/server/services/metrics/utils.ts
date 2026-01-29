import type { DateWindow } from "./types";

const TZ = "America/Los_Angeles";

export function getDateWindow(dateStr: string): DateWindow {
  // Create a date at noon to avoid DST edge cases
  const noonDate = new Date(`${dateStr}T12:00:00`);

  // Format in LA timezone to get the correct local date
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(noonDate);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";
  const localDate = `${get("year")}-${get("month")}-${get("day")}`;

  // Get the timezone offset for start and end of day
  // This handles DST correctly by computing offset at the actual time
  const startStr = `${localDate}T00:00:00`;
  const endStr = `${localDate}T23:59:59.999`;

  const start = toTimezoneDate(startStr, TZ);
  const end = toTimezoneDate(endStr, TZ);

  return { start, end };
}

function toTimezoneDate(localDateTimeStr: string, timezone: string): Date {
  // Create a date string and use Intl to find the UTC offset at that moment
  const testDate = new Date(localDateTimeStr + "Z");

  const utcFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const tzFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Get the same moment in both UTC and target timezone
  const utcParts = utcFormatter.formatToParts(testDate);
  const tzParts = tzFormatter.formatToParts(testDate);

  const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((p) => p.type === type)?.value || "0";

  const utcHour = parseInt(getPart(utcParts, "hour"), 10);
  const tzHour = parseInt(getPart(tzParts, "hour"), 10);
  const utcDay = parseInt(getPart(utcParts, "day"), 10);
  const tzDay = parseInt(getPart(tzParts, "day"), 10);

  // Calculate offset in hours (accounting for day boundary)
  let offsetHours = utcHour - tzHour;
  if (utcDay > tzDay) offsetHours += 24;
  if (utcDay < tzDay) offsetHours -= 24;

  // Parse the local datetime and adjust by offset
  const [datePart, timePart] = localDateTimeStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, secondMs] = timePart.split(":");
  const [second, ms = "0"] = (secondMs || "0").split(".");

  const utcDate = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      parseInt(hour, 10) + offsetHours,
      parseInt(minute, 10),
      parseInt(second, 10),
      parseInt(ms.padEnd(3, "0").slice(0, 3), 10)
    )
  );

  return utcDate;
}

export function getYesterday(): string {
  return getDaysAgoInTz(1, TZ);
}

export function getDaysAgo(days: number): string {
  return getDaysAgoInTz(days, TZ);
}

export function getToday(): string {
  return getDaysAgoInTz(0, TZ);
}

function getDaysAgoInTz(days: number, timezone: string): string {
  const now = new Date();

  // Get current date in LA timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";

  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10);
  const day = parseInt(get("day"), 10);

  // Create date and subtract days
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - days);

  return date.toISOString().split("T")[0];
}

export function parseDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
