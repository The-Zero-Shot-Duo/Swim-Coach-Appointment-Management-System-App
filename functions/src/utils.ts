// functions/src/utils.ts
// functions/src/utils.ts

import type { Request } from "express";
import { DateTime } from "luxon";
import * as crypto from "crypto";
import { db } from "./firebase"; // <-- ADD THIS IMPORT

/**
 * Normalizes a string by trimming and converting it to lowercase for consistent comparisons.
 * @param {string | null | undefined} s - The input string.
 * @returns {string} The canonical string.
 */
export const canon = (s?: string | null): string =>
  (s || "").trim().toLowerCase();

/**
 * Computes an HMAC-SHA256 hash for signature verification.
 * @param {Buffer | string} body - The data to be signed.
 * @param {string} secret - The shared secret key.
 * @returns {string} The computed hash in hexadecimal format.
 */
function hmacHexSHA256(body: Buffer | string, secret: string): string {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  return crypto.createHmac("sha256", secret).update(buf).digest("hex");
}

/**
 * Safely retrieves a header value from the request object.
 * @param {Request} req - The Express request object.
 * @param {string} name - The name of the header to retrieve.
 * @returns {string} The header value.
 */
function getHeader(req: Request, name: string): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const v = req.headers[name.toLowerCase()] as string | string[] | undefined;
  return Array.isArray(v) ? v.join(",") : v ?? "";
}

/**
 * Verifies the incoming webhook request signature against the stored secret.
 * @param {Request} req - The Express request object.
 * @returns {Promise<boolean>} A promise that resolves to true if the signature is valid or not required, false otherwise.
 */
export async function verifySignature(req: Request): Promise<boolean> {
  try {
    const snap = await db.collection("system").doc("webhook").get();
    const secret = (snap.data()?.secret as string) || "";
    if (!secret) {
      console.log("[ingest] signature: skip (no secret configured)");
      return true;
    }
    const header = getHeader(req, "X-Vivi-Signature");
    const m = /^sha256=([0-9a-f]+)$/i.exec(header);
    if (!m) {
      console.log("[ingest] signature: missing/format");
      return false;
    }
    const body = (req as any).body || {};
    const messageId = (body.messageId as string) || "";
    const date = (body.date as string) || "";
    if (!messageId || !date) {
      console.log("[ingest] signature: missing messageId or date in body");
      return false;
    }
    const dataToSign = `${messageId}.${date}`;
    const hex = hmacHexSHA256(dataToSign, secret);
    const expectedSignature = Buffer.from(m[1], "hex");
    const actualSignature = Buffer.from(hex, "hex");
    const ok = crypto.timingSafeEqual(expectedSignature, actualSignature);
    if (!ok) {
      console.log("[ingest] signature: mismatch");
    }
    return ok;
  } catch (e) {
    console.log("[ingest] signature error:", e);
    return false;
  }
}

/**
 * Strips HTML tags and normalizes whitespace from a string.
 * @param {unknown} html - The HTML content to clean.
 * @returns {string} The plain text representation.
 */
export function stripHtmlSafe(html: unknown): string {
  const s = typeof html === "string" ? html : "";
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Checks if a given date is in the past beyond a grace period.
 * @param {Date | undefined | null} date - The date to check.
 * @returns {boolean} True if the date is considered in the past.
 */
export function isPast(date: Date | undefined | null): boolean {
  if (!date) return false;
  const PAST_GRACE_MIN = 10;
  const now = DateTime.now();
  const dt = DateTime.fromJSDate(date);
  return dt.diff(now, "minutes").minutes < -PAST_GRACE_MIN;
}

/**
 * Generates a structured, human-readable notes string from appointment details.
 * @param {object} details - The appointment details.
 * @param {string} [details.studentName] - The name of the student.
 * @param {string} [details.courseName] - The name of the course/lesson type.
 * @param {string} [details.coachName] - The name of the coach.
 * @param {Date} details.start - The start date and time of the appointment.
 * @param {Date} details.end - The end date and time of the appointment.
 * @returns {string} A formatted string containing the appointment notes.
 */
export function generateStructuredNotes(details: {
  studentName?: string;
  courseName?: string;
  coachName?: string;
  start: Date;
  end: Date;
}): string {
  const { studentName, courseName, coachName, start, end } = details;
  const zone = "America/Los_Angeles";
  const startTime = DateTime.fromJSDate(start).setZone(zone).toFormat("f");
  const endTime = DateTime.fromJSDate(end).setZone(zone).toFormat("t");

  const notes = [
    `Student: ${studentName || "N/A"}`,
    `Lesson Type: ${courseName || "N/A"}`,
    `Coach: ${coachName || "N/A"}`,
    `Start Time: ${startTime}`,
    `End Time: ${endTime}`,
  ];

  return notes.join("\n");
}
