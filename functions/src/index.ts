// functions/src/index.ts

import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { DateTime } from "luxon";
// ✅ 使用 Admin SDK 的模块化 Firestore 导入
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

setGlobalOptions({ region: "us-central1" });

if (!admin.apps.length) {
  admin.initializeApp();
  console.log("[functions] admin initialized");
}

// ✅ 用模块化的 getFirestore()
const db = getFirestore();

/* ----------------------------- 小工具 & 规范化 ----------------------------- */

const trim = (s?: string | null) => (s ?? "").trim();

const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v?.toDate) return v.toDate(); // Firestore Timestamp
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

function canonName(s?: string | null): string {
  const x = trim(s).toLowerCase().replace(/\s+/g, " ");
  return x;
}

function splitCamelCoach(s: string): string {
  if (!s) return s;
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

function splitStudentList(raw?: string | null): string[] {
  const s = trim(raw);
  if (!s) return [];
  const replaced = s.replace(/\s+and\s+/gi, "&").replace(/,/g, "&");
  return replaced
    .split("&")
    .map((x) => trim(x))
    .filter(Boolean);
}

/* ----------------------------- 解析邮件内容 ----------------------------- */

type ParsedAction = "book" | "cancel" | "change" | "unknown";

function detectAction(subject: string, text: string): ParsedAction {
  const S = subject.toLowerCase();
  const T = text.toLowerCase();

  if (S.includes("has booked") || S.includes("confirmation of booking")) {
    return "book";
  }
  if (
    S.includes("confirmation of cancellation") ||
    T.includes("has been cancelled")
  ) {
    return "cancel";
  }
  if (
    S.includes("rescheduled") ||
    S.includes("changed") ||
    T.includes("rescheduled")
  ) {
    return "change";
  }
  return "unknown";
}

function parseWhen(
  subject: string,
  text: string
): { start?: Date; end?: Date } {
  const whenLine = (text.match(/^When:\s*(.+)$/im) || [])[1];
  if (whenLine) {
    const zoneMatch = whenLine.match(/\(([^)]+)\)\s*$/);
    const zone = zoneMatch ? zoneMatch[1] : "UTC";
    const main = whenLine.replace(/\s*\([^)]+\)\s*$/, "");

    const m = main.match(/(.+?)\s+–\s+(.+)$/);
    if (m) {
      const left = m[1];
      const right = m[2];

      const datePart = left.replace(/\d{1,2}:\d{2}\s*[ap]m?/i, "").trim();
      const startStr = left.trim();
      const endStr = `${datePart} ${right}`.trim();

      const fmts = [
        "EEE MMM d, yyyy h:mm a",
        "EEE MMM dd, yyyy h:mm a",
        "EEE MMM d, yyyy h a",
        "EEE MMM dd, yyyy h a",
      ];

      let start: Date | null = null;
      let end: Date | null = null;
      for (const f of fmts) {
        if (!start) {
          const dt = DateTime.fromFormat(startStr, f, { zone });
          if (dt.isValid) start = dt.toJSDate();
        }
        if (!end) {
          const dt = DateTime.fromFormat(endStr, f, { zone });
          if (dt.isValid) end = dt.toJSDate();
        }
      }
      if (start && end) return { start, end };
    }
  }

  const cancelLine =
    subject.match(
      /on\s+(\d{2}[-/]\d{2}[-/]\d{4})\s+at\s+(\d{1,2}:\d{2}\s*[AP]M)/i
    ) ||
    text.match(
      /on\s+(\d{2}[-/]\d{2}[-/]\d{4})\s+at\s+(\d{1,2}:\d{2}\s*[AP]M)/i
    );
  if (cancelLine) {
    const datePart = cancelLine[1];
    const timePart = cancelLine[2];
    const dt = DateTime.fromFormat(
      `${datePart} ${timePart}`,
      "MM-dd-yyyy h:mm a",
      {
        zone: "UTC",
      }
    );
    if (dt.isValid) {
      const start = dt.toJSDate();
      const end = DateTime.fromJSDate(start).plus({ minutes: 60 }).toJSDate();
      return { start, end };
    }
  }

  return {};
}

function extractCoachHint(subject: string, text: string): string | null {
  const coach1 = subject.match(/with\s+Coach([A-Za-z]+)/i);
  if (coach1) return splitCamelCoach(`Coach${coach1[1]}`);

  const coach2 = text.match(/^Who:\s*(Coach[A-Za-z]+)/im);
  if (coach2) return splitCamelCoach(coach2[1]);

  const coach3 = text.match(/^Who:\s*(.+)$/im);
  if (coach3) return splitCamelCoach(coach3[1]);

  return null;
}

function extractStudents(
  subject: string,
  text: string
): {
  studentName?: string;
  studentNames?: string[];
} {
  const m1 = subject.match(/^(.+?)\s+has booked/i);
  if (m1) {
    const raw = trim(m1[1]);
    const list = splitStudentList(raw);
    return {
      studentName: raw,
      studentNames: list.length ? list : [raw],
    };
  }

  const m2 = text.match(/has been cancelled for\s+(.+?)\.\s*$/im);
  if (m2) {
    const raw = trim(m2[1]);
    const list = splitStudentList(raw);
    return {
      studentName: raw,
      studentNames: list.length ? list : [raw],
    };
  }
  return {};
}

/* ----------------------------- 查教练（别名匹配） ----------------------------- */

async function findCoachByAlias(hint?: string | null): Promise<string | null> {
  const raw = trim(hint);
  if (!raw) return null;

  const base = splitCamelCoach(raw);
  const variants = new Set<string>([
    canonName(base),
    canonName(base.replace(/^coach\s*/i, "")),
    canonName(base.replace(/\s+/g, "")),
  ]);

  const snap = await db.collection("coaches").get();
  for (const doc of snap.docs) {
    const data = doc.data() as any;
    const pool = new Set<string>();

    if (data.displayName) pool.add(canonName(data.displayName));
    if (data.email) {
      pool.add(canonName(data.email));
      pool.add(canonName(String(data.email).split("@")[0]));
    }

    const arr1: string[] = Array.isArray(data.aliases) ? data.aliases : [];
    const arr2: string[] = Array.isArray(data.aliasesLower)
      ? data.aliasesLower
      : arr1.map((x: string) => canonName(x));

    for (const a of [...arr1, ...arr2]) {
      const c = canonName(a);
      pool.add(c);
      pool.add(c.replace(/\s+/g, ""));
    }

    for (const v of variants) {
      if (pool.has(v)) {
        console.log("[coach] hit", doc.id, "by", v);
        return doc.id;
      }
    }
  }
  console.log("[coach] not found for hint:", raw);
  return null;
}

/* ----------------------------- 写入 & 取消 ----------------------------- */

async function upsertAppointment(args: {
  coachId: string;
  subject: string;
  text: string;
  when: { start?: Date | string | null; end?: Date | string | null };
  studentName?: string | null;
  studentNames?: string[] | null;
}) {
  const { coachId, subject, text, when, studentName, studentNames } = args;

  const startDate = toDate(when?.start);
  const endDate = toDate(when?.end);
  if (!startDate || !endDate)
    throw new Error("Booking parsed but start/end missing");

  const startISO = DateTime.fromJSDate(startDate).toISO();
  const endISO = DateTime.fromJSDate(endDate).toISO();

  console.log("[upsert] startISO:", startISO, "endISO:", endISO);

  const baseDoc = {
    coachId,
    title: subject ?? "Lesson",
    start: startISO,
    end: endISO,
    // ✅ 模块化 Timestamp
    startTS: Timestamp.fromDate(startDate),
    endTS: Timestamp.fromDate(endDate),
    extendedProps: {
      coachId,
      studentName: studentName ?? null,
      studentNames: studentNames ?? null,
      rawText: text ?? null,
    },
    // ✅ 模块化 FieldValue
    updatedAt: FieldValue.serverTimestamp(),
  };

  const existing = await db
    .collection("appointments")
    .where("coachId", "==", coachId)
    .where("start", "==", startISO)
    .limit(1)
    .get();

  if (!existing.empty) {
    console.log("[upsert] found existing, merge:", existing.docs[0].id);
    await existing.docs[0].ref.set(baseDoc, { merge: true });
    return { id: existing.docs[0].id, deleted: false };
  }

  const ref = await db.collection("appointments").add({
    ...baseDoc,
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log("[upsert] created:", ref.id);
  return { id: ref.id, deleted: false };
}

async function cancelAppointmentStrict(args: {
  when: { start?: Date };
  studentNames: string[];
  coachUid?: string | null;
}) {
  const { when, studentNames, coachUid } = args;
  if (!when.start) throw new Error("Cancel requires a start time");

  const startISO = DateTime.fromJSDate(when.start).toISO();
  const studentsCanon = studentNames.map(canonName);
  const coachFilter = coachUid ? canonName(coachUid) : null;

  const col = db.collection("appointments");

  // A) 用 ISO 等值
  let snap = await col.where("start", "==", startISO).get();
  let candidates = snap.docs
    .map((d) => ({ ref: d.ref, data: d.data() as any }))
    .filter((x) => {
      const coach = canonName(x.data.coachId);
      const names: string[] = [];
      if (x.data.extendedProps?.studentName)
        names.push(x.data.extendedProps.studentName);
      if (x.data.studentName) names.push(x.data.studentName);
      if (Array.isArray(x.data.extendedProps?.studentNames)) {
        names.push(...x.data.extendedProps.studentNames);
      }
      const namesCanon = names.map(canonName);
      const studentOK = studentsCanon.some((s) => namesCanon.includes(s));
      const coachOK = coachFilter ? coach === coachFilter : true;

      console.log("[cancel][A-check]", {
        doc: x.ref.path,
        names,
        studentsCanon,
        coach,
        coachFilter,
        studentOK,
        coachOK,
      });

      return studentOK && coachOK;
    });

  // B) ±2 分钟兜底（TS 范围）
  if (candidates.length === 0) {
    const start = DateTime.fromJSDate(when.start).startOf("minute");
    const minus = Timestamp.fromDate(start.minus({ minutes: 2 }).toJSDate());
    const plus = Timestamp.fromDate(start.plus({ minutes: 2 }).toJSDate());

    snap = await col
      .where("startTS", ">=", minus)
      .where("startTS", "<=", plus)
      .get();

    candidates = snap.docs
      .map((d) => ({ ref: d.ref, data: d.data() as any }))
      .filter((x) => {
        const coach = canonName(x.data.coachId);
        const names: string[] = [];
        if (x.data.extendedProps?.studentName)
          names.push(x.data.extendedProps.studentName);
        if (x.data.studentName) names.push(x.data.studentName);
        if (Array.isArray(x.data.extendedProps?.studentNames)) {
          names.push(...x.data.extendedProps.studentNames);
        }
        const namesCanon = names.map(canonName);
        const studentOK = studentsCanon.some((s) => namesCanon.includes(s));
        const coachOK = coachFilter ? coach === coachFilter : true;

        console.log("[cancel][B-check]", {
          doc: x.ref.path,
          names,
          studentsCanon,
          coach,
          coachFilter,
          studentOK,
          coachOK,
        });

        return studentOK && coachOK;
      });
  }

  if (candidates.length === 0) {
    throw new Error(
      "Cancel failed: no appointment matched by time & student" +
        (coachFilter ? " & coach" : "") +
        "."
    );
  }
  if (candidates.length > 1) {
    throw new Error(
      "Cancel failed: multiple appointments matched (time & student" +
        (coachFilter ? " & coach" : "") +
        "). Please disambiguate."
    );
  }

  await candidates[0].ref.delete();
  return { id: candidates[0].ref.id, deleted: true };
}

/* ----------------------------- 入口函数 ----------------------------- */

export const ingestEmail = onRequest(
  { cors: true },
  async (req: any, res: any) => {
    try {
      console.log("[ingest] method:", req.method);
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Only POST allowed" });
      }

      const subject = trim(req.body?.subject);
      const text = trim(req.body?.text);
      console.log("[ingest] body:", JSON.stringify({ subject, text }));

      if (!subject && !text) {
        return res
          .status(400)
          .json({ ok: false, error: "Missing subject/text" });
      }

      const action = detectAction(subject, text);
      console.log("[ingest] action:", action);

      if (action === "unknown") {
        return res.status(400).json({ ok: false, error: "Unknown email type" });
      }

      const coachHint = extractCoachHint(subject, text);
      console.log("[ingest] coachHint:", coachHint ?? null);

      const when = parseWhen(subject, text);
      console.log("[ingest] when:", {
        start: when.start ? DateTime.fromJSDate(when.start).toISO() : null,
        end: when.end ? DateTime.fromJSDate(when.end).toISO() : null,
      });

      const students = extractStudents(subject, text);
      const studentName = students.studentName;
      const studentNames = students.studentNames ?? [];
      console.log("[ingest] students:", { studentName, studentNames });

      let coachUid: string | null = null;
      if (coachHint) {
        coachUid = await findCoachByAlias(coachHint);
        console.log("[ingest] coachIdFromHint:", coachUid);
        if (!coachUid && action !== "cancel") {
          return res.status(400).json({
            ok: false,
            error: `Coach not found for hint: ${coachHint}. Add to coaches.aliases.`,
          });
        }
      }

      if (action === "book") {
        if (!when.start || !when.end) {
          return res
            .status(400)
            .json({ ok: false, error: "Booking parsed but start/end missing" });
        }
        if (!coachUid) {
          return res.status(400).json({
            ok: false,
            error: "Booking requires a coach (not found in subject/text)",
          });
        }
        const result = await upsertAppointment({
          coachId: coachUid,
          subject,
          text,
          when,
          studentName: studentName ?? null,
          studentNames: studentNames.length ? studentNames : null,
        });
        return res.json({
          ok: true,
          action: "book",
          coachId: coachUid,
          ...result,
          parsed: {
            startISO: DateTime.fromJSDate(when.start).toISO(),
            endISO: DateTime.fromJSDate(when.end).toISO(),
            studentName,
            studentNames,
          },
        });
      }

      if (action === "cancel") {
        if (!when.start) {
          return res
            .status(400)
            .json({ ok: false, error: "Cancel requires start time" });
        }
        if (!studentNames.length && !studentName) {
          return res
            .status(400)
            .json({ ok: false, error: "Cancel requires student name(s)" });
        }
        const result = await cancelAppointmentStrict({
          when: { start: when.start },
          studentNames: studentNames.length
            ? studentNames
            : studentName
            ? [studentName]
            : [],
          coachUid,
        });
        return res.json({
          ok: true,
          action: "cancel",
          coachId: coachUid ?? null,
          ...result,
          parsed: {
            startISO: DateTime.fromJSDate(when.start).toISO(),
            studentName,
            studentNames,
          },
        });
      }

      if (action === "change") {
        if (!when.start || !when.end) {
          return res
            .status(400)
            .json({ ok: false, error: "Change requires new start/end" });
        }
        if (!coachUid) {
          return res.status(400).json({
            ok: false,
            error: "Change requires a coach (not found in subject/text)",
          });
        }
        const result = await upsertAppointment({
          coachId: coachUid,
          subject,
          text,
          when,
          studentName: studentName ?? null,
          studentNames: studentNames.length ? studentNames : null,
        });
        return res.json({
          ok: true,
          action: "change",
          coachId: coachUid,
          ...result,
          parsed: {
            startISO: DateTime.fromJSDate(when.start).toISO(),
            endISO: DateTime.fromJSDate(when.end).toISO(),
            studentName,
            studentNames,
          },
        });
      }

      return res.status(400).json({ ok: false, error: "Unhandled action" });
    } catch (e: any) {
      console.error("[ingest] error:", e);
      return res
        .status(400)
        .json({ ok: false, error: String(e?.message || e) });
    }
  }
);
