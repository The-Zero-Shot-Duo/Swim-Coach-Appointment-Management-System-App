// functions/src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import * as admin from "firebase-admin";
import { DateTime } from "luxon";
import * as crypto from "crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

const PAST_GRACE_MIN = 10;

// --- Interfaces ---
interface AppointmentData {
  coachId: string;
  studentName?: string;
  title?: string;
  extendedProps?: {
    coachId?: string;
    studentName?: string;
    studentNames?: string[];
  };
}

// --- Utils ---
const canon = (s?: string | null) => (s || "").trim().toLowerCase();

function hmacHexSHA256(body: Buffer | string, secret: string): string {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
  return crypto.createHmac("sha256", secret).update(buf).digest("hex");
}

function getHeader(req: Request, name: string): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const v = req.headers[name.toLowerCase()] as string | string[] | undefined;
  return Array.isArray(v) ? v.join(",") : v ?? "";
}

function stripHtmlSafe(html: unknown): string {
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

function isPast(date: Date | undefined | null): boolean {
  if (!date) return false;
  const now = DateTime.now();
  const dt = DateTime.fromJSDate(date);
  return dt.diff(now, "minutes").minutes < -PAST_GRACE_MIN;
}

async function verifySignature(req: Request): Promise<boolean> {
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
 * 根据预约的详细信息生成结构化的笔记字符串。
 */
function generateStructuredNotes(details: {
  studentName?: string;
  courseName?: string;
  coachName?: string;
  start: Date;
  end: Date;
}): string {
  const { studentName, courseName, coachName, start, end } = details;

  // 使用 Luxon 来格式化时间，并确保时区正确
  const zone = "America/Los_Angeles";
  const startTime = DateTime.fromJSDate(start).setZone(zone).toFormat("f"); // e.g., August 15, 2025 at 2:15 PM PDT
  const endTime = DateTime.fromJSDate(end).setZone(zone).toFormat("t"); // e.g., 3:00 PM

  const notes = [
    `Student: ${studentName || "N/A"}`,
    `Lesson Type: ${courseName || "N/A"}`,
    `Coach: ${coachName || "N/A"}`,
    `Start Time: ${startTime}`,
    `End Time: ${endTime}`,
  ];

  return notes.join("\n");
}

// --- Parsers ---
function cleanCoachHint(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/\s+for\b.*$/i, "")
    .replace(/[^\p{L}\s]+/gu, " ")
    .trim();
}

function extractCoachHint(
  subject: string,
  text: string,
  html?: string
): string | null {
  const haystacks = [text || "", html || "", subject || ""];
  const patterns: RegExp[] = [
    /Who:\s*Coach\s*([A-Za-z]+)/i,
    /with\s+Coach\s*([A-Za-z\s]+?)\b/i, // Made non-greedy
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

function parseAction(
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
  return "book";
}

function parseStudents(
  subject: string,
  text: string
): { studentName?: string; studentNames?: string[] } {
  // For booking
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
  // For cancellation
  m = text.match(/has been cancelled for\s+(.+?)\./i);
  if (m?.[1]) return { studentName: m[1].trim() };

  // Fallback for cancellation subject
  m = subject.match(/cancellation of.*?for\s+(.+)/i);
  if (m?.[1]) return { studentName: m[1].trim() };

  return {};
}

function parseChangeDetails(text: string): {
  studentName?: string;
  start?: Date;
  end?: Date;
  coachHint?: string;
} {
  let studentName: string | undefined;
  let start: Date | undefined;
  let end: Date | undefined;
  let coachHint: string | undefined;

  const studentMatch = text.match(/^Confirmation:\s+(.+?)’s booking/i);
  if (studentMatch?.[1]) {
    studentName = studentMatch[1].trim();
  }
  const detailsMatch = text.match(
    /changed to\s+(\d{2}[-/]\d{2}[-/]\d{4})\s+at\s+(\d{1,2}:\d{2}\s*[AP]M)\s+to\s+(\d{1,2}:\d{2}\s*[AP]M)(?:\s+with\s+(Coach[A-Za-z\s]+))?/i
  );
  if (detailsMatch) {
    const [, dateStr, startTimeStr, endTimeStr, coachStr] = detailsMatch;
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
  return { studentName, start, end, coachHint };
}

function parseWhen(
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
        if (start) {
          return { start, end };
        }
      } catch (e) {
        /* ignore */
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

// --- Database Operations ---
async function findCoachIdByHint(hint: string | null): Promise<string | null> {
  if (!hint) return null;
  const variants = new Set<string>();
  variants.add(hint);
  variants.add(hint.replace(/^Coach\s*/i, "").trim());
  variants.add(`Coach ${hint}`.trim());
  variants.add(hint.replace(/\s+/g, ""));
  for (const v of variants) {
    const q = await db
      .collection("coaches")
      .where("aliases", "array-contains", v)
      .limit(1)
      .get();
    if (!q.empty) return q.docs[0].id;
  }
  const all = await db.collection("coaches").limit(500).get();
  const target = canon(hint)
    .replace(/^coach\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  for (const d of all.docs) {
    const aliases: string[] = (d.data() as any)?.aliases || [];
    const normed = aliases.map((a) =>
      canon(a)
        .replace(/^coach\s*/, "")
        .replace(/\s+/g, " ")
        .trim()
    );
    if (normed.includes(target)) return d.id;
  }
  return null;
}

async function upsertAppointment(args: {
  coachId: string;
  subject: string;
  text: string;
  start: Date;
  end: Date;
  students: { studentName?: string; studentNames?: string[] };
  coachHint: string | null;
}) {
  const { coachId, subject, text, start, end, students, coachHint } = args;
  const startISO = DateTime.fromJSDate(start).toISO();
  const endISO = DateTime.fromJSDate(end).toISO();
  if (!startISO || !endISO) throw new Error("Invalid start or end date.");
  const col = db.collection("appointments");
  const exists = await col
    .where("coachId", "==", coachId)
    .where("start", "==", startISO)
    .limit(1)
    .get();
  const payload = {
    title: students.studentName ? `Lesson – ${students.studentName}` : "Lesson",
    coachId,
    start: startISO,
    end: endISO,
    startTS: Timestamp.fromDate(start),
    endTS: Timestamp.fromDate(end),
    extendedProps: {
      coachId,
      subject,
      notes: generateStructuredNotes({
        studentName: students.studentName,
        courseName: subject.includes("Private lesson")
          ? "Private lesson"
          : "Trial class", // 这是一个简单的课程类型解析，你可以根据需要扩展
        coachName: coachHint || "N/A",
        start: start,
        end: end,
      }),
      ...(students.studentName ? { studentName: students.studentName } : {}),
      ...(students.studentNames ? { studentNames: students.studentNames } : {}),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(exists.empty && {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }),
  };
  if (!exists.empty) {
    await exists.docs[0].ref.set(payload, { merge: true });
    return exists.docs[0].ref.id;
  }
  const docRef = await col.add(payload);
  return docRef.id;
}

async function updateAppointment(args: {
  studentName: string;
  newCoachId: string;
  newStart: Date;
  newEnd: Date;
  newCoachHint: string | null;
}) {
  const { studentName, newCoachId, newStart, newEnd, newCoachHint } = args;
  const studentKey = canon(studentName);
  const col = db.collection("appointments");
  const now = Timestamp.now();
  const snap = await col
    .where("startTS", ">=", now)
    .orderBy("startTS", "asc")
    .get();
  if (snap.empty)
    throw new Error(
      `Update failed: No future appointments found for any coach.`
    );
  const candidates = snap.docs
    .map((d) => ({ ref: d.ref, data: d.data() as AppointmentData }))
    .filter((x) => {
      const names: string[] = [];
      if (x.data.extendedProps?.studentName)
        names.push(x.data.extendedProps.studentName);
      if (x.data.studentName) names.push(x.data.studentName);
      if (
        x.data.extendedProps &&
        Array.isArray(x.data.extendedProps.studentNames)
      ) {
        names.push(...x.data.extendedProps.studentNames);
      }
      return names.some((n) => canon(n) === studentKey);
    });
  if (candidates.length === 0)
    throw new Error(
      `Update failed: No future appointments found for student: "${studentName}".`
    );
  const appointmentToUpdate = candidates[0];
  const oldData = appointmentToUpdate.data;
  const startISO = DateTime.fromJSDate(newStart).toISO();
  const endISO = DateTime.fromJSDate(newEnd).toISO();
  if (!startISO || !endISO)
    throw new Error("Invalid new start or end date for update.");
  await appointmentToUpdate.ref.update({
    coachId: newCoachId,
    start: startISO,
    end: endISO,
    startTS: Timestamp.fromDate(newStart),
    endTS: Timestamp.fromDate(newEnd),
    "extendedProps.coachId": newCoachId,
    "extendedProps.notes": generateStructuredNotes({
      // 从旧数据中获取不变的信息
      studentName: oldData.extendedProps?.studentName || oldData.studentName,
      courseName: oldData.title?.includes("Private lesson")
        ? "Private lesson"
        : "Trial class",
      // 使用新的信息
      coachName: newCoachHint || "N/A",
      start: newStart,
      end: newEnd,
    }),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(
    `[update] Appointment ${appointmentToUpdate.ref.id} updated successfully.`
  );
  return { id: appointmentToUpdate.ref.id, updated: true };
}

async function cancelAppointmentStrict(args: {
  when: { start?: Date };
  studentName: string;
  coachId?: string | null;
}) {
  const { when, studentName, coachId } = args;
  if (!when.start) throw new Error("Cancel requires a start time");
  const studentKey = canon(studentName);
  const col = db.collection("appointments");
  const startISO = DateTime.fromJSDate(when.start).toISO();
  if (!startISO) throw new Error("Invalid start date provided.");
  const filterLogic = (x: { ref: any; data: AppointmentData }) => {
    const docCoachId = x.data.extendedProps?.coachId || x.data.coachId;
    const names: string[] = [];
    if (x.data.extendedProps?.studentName)
      names.push(x.data.extendedProps.studentName);
    if (x.data.studentName) names.push(x.data.studentName);
    if (
      x.data.extendedProps &&
      Array.isArray(x.data.extendedProps.studentNames)
    ) {
      names.push(...x.data.extendedProps.studentNames);
    }
    const studentMatch = names.some((n) => canon(n) === studentKey);
    const coachMatch = coachId ? docCoachId === coachId : true;
    return studentMatch && coachMatch;
  };
  let snap = await col.where("start", "==", startISO).get();
  let candidates = snap.docs
    .map((d) => ({ ref: d.ref, data: d.data() as AppointmentData }))
    .filter(filterLogic);
  if (candidates.length === 0) {
    const start = DateTime.fromJSDate(when.start).startOf("minute");
    const minus = Timestamp.fromDate(start.minus({ minutes: 2 }).toJSDate());
    const plus = Timestamp.fromDate(start.plus({ minutes: 2 }).toJSDate());
    snap = await col
      .where("startTS", ">=", minus)
      .where("startTS", "<=", plus)
      .get();
    candidates = snap.docs
      .map((d) => ({ ref: d.ref, data: d.data() as AppointmentData }))
      .filter(filterLogic);
  }
  if (candidates.length === 0)
    throw new Error(
      "Cancel failed: no appointment matched by time & student" +
        (coachId ? " & coach" : "") +
        "."
    );
  if (candidates.length > 1)
    throw new Error(
      "Cancel failed: multiple appointments matched (time & student" +
        (coachId ? " & coach" : "") +
        ")."
    );
  await candidates[0].ref.delete();
  return { id: candidates[0].ref.id, deleted: true };
}

// --- Main Webhook (最终版) ---
export const ingestEmail = onRequest(
  { cors: true, memory: "512MiB" },
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!(await verifySignature(req))) {
        res
          .status(401)
          .json({ ok: false, error: "Unauthorized (bad signature)" });
        return;
      }

      const raw: Record<string, unknown> = (req as any).body || {};
      const subject = (raw.subject as string) || "";
      const text = (raw.text as string) || stripHtmlSafe(raw.html);
      const html = ((raw.html ?? "") as string) || "";
      const messageId = ((raw.messageId ?? "") as string).toString();

      if (!messageId) {
        res.status(400).json({ ok: false, error: "Message-ID is missing." });
        return;
      }

      // *** 核心逻辑：在这里进行状态检查 ***
      const ingestRef = db.collection("email_ingest").doc(messageId);
      const ingestSnap = await ingestRef.get();

      // 如果邮件已经被成功处理过，立即返回 208，告诉 Apps Script 成功，避免重发
      if (ingestSnap.exists && ingestSnap.data()?.status === "ok") {
        console.log(
          `[ingest] DUPLICATE message already processed, skip: ${messageId}`
        );
        res.status(208).json({
          ok: true,
          duplicate: true,
          reason: "Already processed successfully.",
        });
        return;
      }

      // 先写入一个 "processing" 状态
      await ingestRef.set(
        { status: "processing", receivedAt: Timestamp.now(), payload: raw },
        { merge: true }
      );

      const action = parseAction(subject, text);
      const coachHint = extractCoachHint(subject, text, html);
      const coachId = await findCoachIdByHint(coachHint);

      console.log(
        `[ingest] action: ${action}, coachHint: ${
          coachHint ?? "null"
        }, coachId: ${coachId ?? "null"}`
      );

      // 统一的过期处理函数
      const completeAsExpired = async (
        why: string,
        parsed: object
      ): Promise<void> => {
        await ingestRef.set(
          { status: "ok", action: "expired", reason: why },
          { merge: true }
        );
        res.status(200).json({ ok: true, expired: true, reason: why, parsed });
      };

      // --- 分支逻辑 ---

      if (action === "book") {
        const when = parseWhen(subject, text, html);
        const students = parseStudents(subject, text);
        if (isPast(when.start)) {
          await completeAsExpired("start time already past", {
            ...when,
            ...students,
          });
          return;
        }
        if (!coachId || !when.start || !when.end || !students.studentName) {
          const error = `Book parsed with missing details.`;
          await ingestRef.set({ status: "error", error }, { merge: true });
          res.status(400).json({ ok: false, error });
          return;
        }
        const id = await upsertAppointment({
          coachId,
          subject,
          text,
          start: when.start,
          end: when.end,
          students,
          coachHint,
        });
        await ingestRef.set(
          { status: "ok", action: "book", appointmentId: id },
          { merge: true }
        );
        res.json({ ok: true, action, coachId, id });
        return;
      }

      if (action === "cancel") {
        const when = parseWhen(subject, text, html);
        const students = parseStudents(subject, text);
        if (isPast(when.start)) {
          await completeAsExpired("start time already past", {
            ...when,
            ...students,
          });
          return;
        }
        if (!when.start || !students.studentName) {
          const error = `Cancel parsed with missing details.`;
          await ingestRef.set({ status: "error", error }, { merge: true });
          res.status(400).json({ ok: false, error });
          return;
        }
        try {
          const out = await cancelAppointmentStrict({
            when,
            studentName: students.studentName,
            coachId,
          });
          await ingestRef.set(
            { status: "ok", action: "cancel", appointmentId: out.id },
            { merge: true }
          );
          res.json({ ok: true, action, ...out });
          return;
        } catch (e: any) {
          if (isPast(when.start)) {
            await completeAsExpired("cancel failed but expired", {
              ...when,
              ...students,
            });
            return;
          }
          await ingestRef.set(
            { status: "error", error: String(e?.message || e) },
            { merge: true }
          );
          res.status(400).json({ ok: false, error: String(e?.message || e) });
          return;
        }
      }

      if (action === "change") {
        const details = parseChangeDetails(text);
        if (isPast(details.start)) {
          await completeAsExpired("new start time already past", details);
          return;
        }

        const changeCoachHint = details.coachHint || coachHint;
        const changeCoachId = await findCoachIdByHint(changeCoachHint || null);

        if (
          !details.studentName ||
          !details.start ||
          !details.end ||
          !changeCoachId
        ) {
          const error = `Change parsed with missing details: ${JSON.stringify({
            student: !!details.studentName,
            time: !!details.start,
            coach: !!changeCoachId,
          })}`;
          await ingestRef.set({ status: "error", error }, { merge: true });
          res.status(400).json({ ok: false, error });
          return;
        }
        try {
          const out = await updateAppointment({
            studentName: details.studentName,
            newCoachId: changeCoachId,
            newStart: details.start,
            newEnd: details.end,
            newCoachHint: changeCoachHint,
          });
          await ingestRef.set(
            { status: "ok", action: "change", appointmentId: out.id },
            { merge: true }
          );
          res.json({ ok: true, action, ...out });
          return;
        } catch (e: any) {
          await ingestRef.set(
            { status: "error", error: String(e?.message || e) },
            { merge: true }
          );
          res.status(400).json({ ok: false, error: String(e?.message || e) });
          return;
        }
      }

      // 对于无法识别的 action 类型，跳过并标记
      const reason = `Unhandled action type: ${String(action)}`;
      await ingestRef.set({ status: "skipped", reason }, { merge: true });
      res.status(200).json({ ok: true, skipped: true, reason });
      return;
    } catch (err: any) {
      console.error("[ingest] top-level error:", err);
      // 如果发生顶级错误，也尝试记录到 ingestRef (如果 messageId 可用)
      const messageId = ((req as any).body?.messageId as string)?.toString();
      if (messageId) {
        await db
          .collection("email_ingest")
          .doc(messageId)
          .set(
            {
              status: "error",
              error: "Top-level exception: " + String(err?.message || err),
            },
            { merge: true }
          );
      }
      res.status(500).json({ ok: false, error: String(err?.message || err) });
      return;
    }
  }
);
