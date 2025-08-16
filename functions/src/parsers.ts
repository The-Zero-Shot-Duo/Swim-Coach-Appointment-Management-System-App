// functions/src/parsers.ts

import { DateTime } from "luxon";

/**
 * Cleans up a raw coach hint extracted from an email.
 * @param {string | null | undefined} raw - The raw coach hint string.
 * @returns {string | null} The cleaned coach name or null.
 */
export function cleanCoachHint(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/\s+for\b.*$/i, "")
    .replace(/[^\p{L}\s]+/gu, " ")
    .trim();
}

/**
 * Extracts a coach's name from the email content using a series of regular expressions.
 * @param {string} subject - The email subject.
 * @param {string} text - The plain text body of the email.
 * @param {string} [html] - The HTML body of the email.
 * @returns {string | null} The extracted coach name hint, or null if not found.
 */
export function extractCoachHint(
  subject: string,
  text: string,
  html?: string
): string | null {
  const haystacks = [text || "", html || "", subject || ""];
  const patterns: RegExp[] = [
    /Who:\s*Coach\s*([A-Za-z]+)/i,
    /with\s+Coach\s*([A-Za-z\s]+?)\b/i,
    /\bwith\s+([A-Za-z\s]+?)\s+for\b/i,
    /\bCoach\s+([A-Za-z]+)\b/i,
    /\bCoach([A-Z][a-z]+)\b/,
  ];
  for (const s of haystacks) {
    for (const re of patterns) {
      const m = re.exec(s);
      if (m?.[1]) return cleanCoachHint(m[1]);
    }
  }
  return null;
}

/**
 * Determines the action type (book, cancel, change) based on keywords in the email content.
 * @param {string} subject - The email subject.
 * @param {string} text - The plain text body of the email.
 * @returns {"book" | "cancel" | "change"} The determined action type.
 */
export function parseAction(
  subject: string,
  text: string
): "book" | "cancel" | "change" {
  const s = `${subject} ${text}`.toLowerCase();
  if (s.includes("has booked") || s.includes("booked an appointment"))
    return "book";
  if (
    s.includes("has been cancelled") ||
    s.includes("confirmation of cancellation")
  )
    return "cancel";
  if (
    s.includes("rescheduled") ||
    s.includes("changed") ||
    s.includes("updated") ||
    s.includes("booking change")
  )
    return "change";
  return "book"; // Default action
}

/**
 * Extracts student name(s) from the email content.
 * @param {string} subject - The email subject.
 * @param {string} text - The plain text body of the email.
 * @returns {{ studentName?: string; studentNames?: string[] }} An object with student name details.
 */
export function parseStudents(
  subject: string,
  text: string
): { studentName?: string; studentNames?: string[] } {
  let m = subject.match(/^(.+?)\s+has booked/i);
  if (m?.[1]) {
    const raw = m[1].trim();
    const parts = raw
      .split("&")
      .map((x) => x.trim())
      .filter(Boolean);
    return {
      studentName: raw,
      studentNames: parts.length > 1 ? parts : undefined,
    };
  }
  m = text.match(/has been cancelled for\s+(.+?)\./i);
  if (m?.[1]) return { studentName: m[1].trim() };
  m = subject.match(/cancellation of.*?for\s+(.+)/i);
  if (m?.[1]) return { studentName: m[1].trim() };
  return {};
}

/**
 * Parses details from an appointment change email, including student, time, and coach.
 * @param {string} text - The plain text body of the email.
 * @returns {{ studentName?: string; start?: Date; end?: Date; coachHint?: string; }} Parsed details.
 */
export function parseChangeDetails(text: string): {
  studentName?: string;
  start?: Date;
  end?: Date;
  coachHint?: string;
  courseName?: string;
} {
  let studentName: string | undefined;
  let start: Date | undefined;
  let end: Date | undefined;
  let coachHint: string | undefined;
  let courseName: string | undefined;

  const studentMatch = text.match(/^Confirmation:\s+(.+?)’s booking/i);
  if (studentMatch?.[1]) {
    studentName = studentMatch[1].trim();
  }
  const detailsMatch = text.match(
    /booking for (.+?) changed to\s+(\d{2}[-/]\d{2}[-/]\d{4})\s+at\s+(\d{1,2}:\d{2}\s*[AP]M)\s+to\s+(\d{1,2}:\d{2}\s*[AP]M)(?:\s+with\s+(Coach[A-Za-z\s]+))?/i
  );
  if (detailsMatch) {
    const [, courseStr, dateStr, startTimeStr, endTimeStr, coachStr] =
      detailsMatch;

    courseName = courseStr.trim(); // 提取并赋值

    const zone = "America/Los_Angeles";
    const startDT = DateTime.fromFormat(
      `${dateStr} ${startTimeStr}`,
      "MM-dd-yyyy h:mm a",
      { zone }
    );
    if (startDT.isValid) {
      start = startDT.toUTC().toJSDate();
      const endDT = DateTime.fromFormat(endTimeStr, "h:mm a", { zone }).set({
        year: startDT.year,
        month: startDT.month,
        day: startDT.day,
      });
      if (endDT.isValid) {
        end = endDT.toUTC().toJSDate();
      }
    }
    if (coachStr) {
      coachHint = cleanCoachHint(coachStr) ?? undefined;
    }
  }
  return { studentName, start, end, coachHint, courseName };
}

/**
 * Extracts start and end times from the email content, checking structured data first.
 * @param {string} subject - The email subject.
 * @param {string} text - The plain text body of the email.
 * @param {string} [html] - The HTML body of the email.
 * @returns {{ start?: Date; end?: Date }} An object with start and end dates.
 */
export function parseWhen(
  subject: string,
  text: string,
  html?: string
): { start?: Date; end?: Date } {
  let start: Date | undefined, end: Date | undefined;

  if (html) {
    const m = html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (m) {
      try {
        const json = JSON.parse(m[1].trim());
        const startISO: string | undefined =
          json.startDate ||
          json.reservationFor?.startDate ||
          json?.reservation?.startDate;
        const endISO: string | undefined =
          json.endDate ||
          json.reservationFor?.endDate ||
          json?.reservation?.endDate;
        if (startISO) {
          const dt = DateTime.fromISO(String(startISO), { setZone: true });
          if (dt.isValid) start = dt.toUTC().toJSDate();
        }
        if (endISO) {
          const dt = DateTime.fromISO(String(endISO), { setZone: true });
          if (dt.isValid) end = dt.toUTC().toJSDate();
        }
        if (start) return { start, end };
      } catch (e) {
        /* ignore JSON parsing errors */
      }
    }
  }

  const txt = `${subject}\n${text}`;
  const zone = "America/Los_Angeles";

  let md = txt.match(
    /\bon\s+(\d{2}[-/]\d{2}[-/]\d{4})\s+at\s+(\d{1,2}:\d{2}\s*[AP]M)\b/i
  );
  if (md) {
    const [, d, t] = md;
    const startDT = DateTime.fromFormat(`${d} ${t}`, "MM-dd-yyyy h:mm a", {
      zone,
    });
    if (startDT.isValid) {
      start = startDT.toUTC().toJSDate();
      const sameLine = txt.slice(md.index || 0, (md.index || 0) + 120);
      const mdEnd = sameLine.match(/(?:–|to)\s*(\d{1,2}:\d{2}\s*[AP]M)\b/i);
      if (mdEnd) {
        const endDT = DateTime.fromFormat(mdEnd[1], "h:mm a", { zone }).set({
          year: startDT.year,
          month: startDT.month,
          day: startDT.day,
        });
        if (endDT.isValid) end = endDT.toUTC().toJSDate();
      }
      return { start, end };
    }
  }

  md = txt.match(
    /When:\s*([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s*[AP]M)\s*(?:–|-)\s*(\d{1,2}:\d{2}\s*[AP]M)(?:\s*\(([^)]+)\))?/i
  );
  if (md) {
    const [, startStr, endTimeStr, tz = "UTC"] = md;
    const startDT = DateTime.fromFormat(startStr, "EEE MMM d, yyyy h:mm a", {
      zone: tz,
    });
    if (startDT.isValid) {
      start = startDT.toUTC().toJSDate();
      const endDT = DateTime.fromFormat(endTimeStr, "h:mm a", { zone: tz }).set(
        { year: startDT.year, month: startDT.month, day: startDT.day }
      );
      if (endDT.isValid) end = endDT.toUTC().toJSDate();
      return { start, end };
    }
  }

  return { start, end };
}
