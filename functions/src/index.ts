import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { DateTime } from "luxon";

/** ---------- Admin 初始化 ---------- */
if (!admin.apps.length) {
  admin.initializeApp();
  console.log("[functions] admin initialized");
}
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

/** ---------- 安全：可选的共享密钥（Emulator 可留空） ---------- */
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

/** ---------- 小工具 ---------- */
const canon = (s?: string | null) => (s || "").trim().toLowerCase();

/** 清洗 coach 提示词：去掉 “for …” 之后的内容、标点、多余空格 */
function cleanCoachHint(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/\s+for\b.*$/i, "") // e.g. "Amber for Private lesson" -> "Amber"
    .replace(/[^\p{L}]+/gu, " ") // 非字母变空格（支持多语言）
    .trim();
}

/** 从邮件 text/html/subject 提取教练名字（兼容 CoachAmber / Coach Amber / with CoachAmber / Who: CoachAmber 等） */
function extractCoachHint(
  subject: string,
  text: string,
  html?: string
): string | null {
  const haystacks = [text || "", html || "", subject || ""];

  const patterns: RegExp[] = [
    /Who:\s*Coach\s*([A-Za-z]+)/i, // Who: CoachAmber / Coach Amber
    /with\s+Coach\s*([A-Za-z]+)/i, // with CoachAmber / Coach Amber
    /\bCoach\s+([A-Za-z]+)\b/i, // … Coach Amber …
    /\bCoach([A-Z][a-z]+)\b/, // … CoachAmber …
  ];

  for (const s of haystacks) {
    for (const re of patterns) {
      const m = re.exec(s);
      if (m?.[1]) return cleanCoachHint(m[1]);
    }
  }
  return null;
}

const stripHtml = (html?: string) =>
  (html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

/** 解析邮件动作：book / cancel / change(暂不处理) */
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
    s.includes("updated")
  )
    return "change"; // 先不实现
  return "book"; // 默认按预约处理，避免漏单（可按需改）
}

/** 从 subject / text 提取教练线索，如 "CoachAmber" / "Coach Amber" / "Amber" */
function parseCoachHint(subject: string, text: string): string | null {
  const blob = `${subject}\n${text}`;
  // 常见："with CoachAmber" / "with Coach Amber" / "Who: CoachAmber"
  const m1 = blob.match(/Coach\s*([A-Za-z][A-Za-z ]{0,30})/);
  if (m1?.[1]) return m1[1].trim();
  // 兜底：直接找 “CoachXxx” 无空格
  const m2 = blob.match(/Coach([A-Za-z]+)/);
  if (m2?.[1]) return m2[1].trim();
  return null;
}

/** 解析学员人名（支持 Semi-Private："A&B&C ..."） */
function parseStudents(
  subject: string,
  text: string
): { studentName?: string; studentNames?: string[] } {
  // 例： "... has booked ... for Semi-Private Lesson" 前面的开头就是 "Iris&Victoria&Isabella Family"
  const m = subject.match(/^(.+?)\s+has booked/i);
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
  // 取消类："... has been cancelled for Leandro Jia."
  const m2 = text.match(/has been cancelled for\s+(.+?)\./i);
  if (m2?.[1]) return { studentName: m2[1].trim() };
  return {};
}

/** 解析时间：
 * book: "When: Fri Aug 15, 2025 2:00 PM – 3:00 PM (UTC)"
 * cancel: "on 08-15-2025 at 02:00 PM"
 */
function parseWhen(
  subject: string,
  text: string,
  html?: string
): { start?: Date; end?: Date } {
  let start: Date | undefined;
  let end: Date | undefined;

  // ---------- A. 先尝试解析 JSON-LD ----------
  if (html) {
    const m = html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (m) {
      try {
        const json = JSON.parse(m[1].trim());

        // 有的商家把时间放在根上（startDate / endDate），
        // 有的放在 reservationFor 下；两种都兜一下。
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
          console.log("[when] parsed from ld+json", { startISO, endISO });
          return { start, end };
        }
      } catch (e) {
        console.log("[when] ld+json parse error:", e);
      }
    }
  }

  // ---------- B. 文本格式回退 ----------
  const txt = `${subject}\n${text}`;

  // 例：“… on 08-23-2025 at 03:15 PM …”
  // 默认时区可按需要调整（校区在 Baldwin Park 可用 America/Los_Angeles）
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
      // 再找同一行/附近是否有 “– 3:45 PM” 作为结束
      const sameLine = txt.slice(md.index || 0, (md.index || 0) + 120); // 附近 120 字
      const mdEnd = sameLine.match(/–\s*(\d{1,2}:\d{2}\s*[AP]M)\b/);
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

  // 例：Google 日历类：“When: Fri Aug 15, 2025 2:00 PM – 3:00 PM (UTC)”
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
      const endDT = DateTime.fromFormat(endTimeStr, "h:mm a", {
        zone: tz,
      }).set({
        year: startDT.year,
        month: startDT.month,
        day: startDT.day,
      });
      if (endDT.isValid) end = endDT.toUTC().toJSDate();
      return { start, end };
    }
  }

  // 兜底：返回 undefined，交给上游做缺失处理
  return { start, end };
}

/** 基于别名匹配教练 uid（优先 array-contains 命中；不行再全量拉取本地忽略大小写匹配） */
async function findCoachIdByHint(hint: string | null): Promise<string | null> {
  if (!hint) return null;

  // 变体（有/无 Coach 前缀、带空格/无空格）
  const variants = new Set<string>();
  const add = (s: string) => variants.add(s);
  add(hint);
  add(hint.replace(/^Coach\s*/i, "").trim());
  add(`Coach ${hint}`.trim());
  add(hint.replace(/\s+/g, "")); // CoachAmber → Coach Amber 的反向匹配会靠下方本地匹配

  // 1) 尝试用 array-contains 精确命中（大小写敏感）
  for (const v of variants) {
    const q = await db
      .collection("coaches")
      .where("aliases", "array-contains", v)
      .limit(1)
      .get();
    if (!q.empty) {
      const id = q.docs[0].id;
      console.log("[coach] hit", id, "by", v);
      return id;
    }
  }

  // 2) 本地忽略大小写匹配（小流量可接受）
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
    if (normed.includes(target)) {
      console.log("[coach] local hit", d.id, "by", hint);
      return d.id;
    }
  }

  console.log("[coach] not found for hint:", hint);
  return null;
}

/** 写入/更新预约（去重策略：同一 coachId + 同一天 + 同一 start 即视作同一条） */
async function upsertAppointment(args: {
  coachId: string;
  subject: string;
  text: string;
  start: Date;
  end: Date;
  students: { studentName?: string; studentNames?: string[] };
}) {
  const { coachId, subject, text, start, end, students } = args;

  const startISO = DateTime.fromJSDate(start).toISO()!;
  const endISO = DateTime.fromJSDate(end).toISO()!;
  console.log("[upsert] startISO:", startISO, "endISO:", endISO);

  const col = db.collection("appointments");

  // 先看同 coach 同 start 是否已存在（避免重复）
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
      notes: text.slice(0, 3000),
      ...(students.studentName ? { studentName: students.studentName } : {}),
      ...(students.studentNames ? { studentNames: students.studentNames } : {}),
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!exists.empty) {
    await exists.docs[0].ref.set(payload, { merge: true });
    return exists.docs[0].ref.id;
  } else {
    const docRef = await col.add(payload);
    return docRef.id;
  }
}

/** 严格取消：按 start（ISO 或 TS±2min）+ 学员名（支持数组）+ 可选 coach 约束 */
async function cancelAppointmentStrict(args: {
  when: { start?: Date };
  studentName: string;
  coachIdHint?: string | null;
}) {
  const { when, studentName, coachIdHint } = args;
  if (!when.start) throw new Error("Cancel requires a start time");

  const studentKey = canon(studentName);
  const coachKey = coachIdHint ? canon(coachIdHint) : null;

  const col = db.collection("appointments");

  // A) 先等值匹配 ISO
  const startISO = DateTime.fromJSDate(when.start).toISO()!;
  let snap = await col.where("start", "==", startISO).get();
  let candidates = snap.docs
    .map((d) => ({ ref: d.ref, data: d.data() as any }))
    .filter((x) => {
      const coach = canon(x.data.extendedProps?.coachId || x.data.coachId);
      const names: string[] = [];
      if (x.data.extendedProps?.studentName)
        names.push(x.data.extendedProps.studentName);
      if (x.data.studentName) names.push(x.data.studentName);
      if (Array.isArray(x.data.extendedProps?.studentNames)) {
        names.push(...(x.data.extendedProps.studentNames as string[]));
      }
      const anyMatch = names.some((n) => canon(n) === studentKey);
      const coachOK = coachKey ? coach === coachKey : true;
      console.log("[cancel][A-check]", {
        doc: x.ref.path,
        names,
        namesCanon: names.map(canon),
        targetStudent: studentKey,
        coach,
        coachKey,
      });
      return anyMatch && coachOK;
    });

  // B) TS 范围兜底（±2min）
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
        const coach = canon(x.data.extendedProps?.coachId || x.data.coachId);
        const names: string[] = [];
        if (x.data.extendedProps?.studentName)
          names.push(x.data.extendedProps.studentName);
        if (x.data.studentName) names.push(x.data.studentName);
        if (Array.isArray(x.data.extendedProps?.studentNames)) {
          names.push(...(x.data.extendedProps.studentNames as string[]));
        }
        const anyMatch = names.some((n) => canon(n) === studentKey);
        const coachOK = coachKey ? coach === coachKey : true;
        console.log("[cancel][B-check]", {
          doc: x.ref.path,
          names,
          namesCanon: names.map(canon),
          targetStudent: studentKey,
          coach,
          coachKey,
        });
        return anyMatch && coachOK;
      });
  }

  if (candidates.length === 0) {
    throw new Error(
      "Cancel failed: no appointment matched by time & student" +
        (coachKey ? " & coach" : "") +
        "."
    );
  }
  if (candidates.length > 1) {
    throw new Error(
      "Cancel failed: multiple appointments matched (time & student" +
        (coachKey ? " & coach" : "") +
        ")."
    );
  }

  await candidates[0].ref.delete();
  return { id: candidates[0].ref.id, deleted: true };
}

/** ---------- 入口：HTTP Webhook ---------- */
export const ingestEmail = onRequest({ cors: true }, async (req, res) => {
  try {
    console.log("[ingest] method:", req.method);

    // —— 签名校验（可选，但建议开启）——
    const incomingSecret =
      (req.headers["x-webhook-secret"] as string) ||
      (typeof (req as any).get === "function" &&
        (req as any).get("x-webhook-secret")) ||
      "";
    if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) {
      console.log("[ingest] bad secret");
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    // —— 解析 body ——（Apps Script/ Postman 都会是 JSON）
    const raw =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const subject: string = raw.subject || "";
    const html: string = raw.html || ""; // <<< 新增：保留 html 原文
    const text: string = raw.text || stripHtml(raw.html || "");
    const from: string = raw.from || "";
    const to: string = raw.to || "";

    console.log("[ingest] body:", JSON.stringify({ subject, text }));

    // —— 原始留痕 ——（如果失败也不影响主流程）
    try {
      await db.collection("email_ingest").add({
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        from,
        to,
        subject,
        payload: raw,
      });
    } catch (e) {
      console.log("[ingest] log raw error:", e);
    }

    // —— 解析动作、时间、学员、教练 —— //
    const action = parseAction(subject, text);
    console.log("[ingest] action:", action);

    const coachHintRaw = extractCoachHint(subject, text, html);
    const coachHint = cleanCoachHint(coachHintRaw);
    console.log(
      "[ingest] coachHintRaw -> coachHint:",
      coachHintRaw,
      "->",
      coachHint
    );

    const when = parseWhen(subject, text, raw.html || "");
    console.log("[ingest] when:", {
      start: when.start ? DateTime.fromJSDate(when.start).toISO() : null,
      end: when.end ? DateTime.fromJSDate(when.end).toISO() : null,
    });

    const students = parseStudents(subject, text);
    console.log("[ingest] students:", students);

    const coachId = await findCoachIdByHint(coachHint);
    console.log("[ingest] coachIdFromHint:", coachId);

    if (action === "book") {
      if (!coachId) {
        res.status(400).json({
          ok: false,
          error: `Coach not found for hint: ${
            coachHint ?? "(none)"
          } . Add to coaches.aliases.`,
        });
        return;
      }
      if (!when.start || !when.end) {
        res.status(400).json({
          ok: false,
          error: "Booking parsed but start or end missing",
        });
        return;
      }
      const id = await upsertAppointment({
        coachId,
        subject,
        text,
        start: when.start,
        end: when.end,
        students,
      });
      res.json({
        ok: true,
        action,
        coachId,
        id,
        deleted: false,
        parsed: {
          startISO: DateTime.fromJSDate(when.start).toISO(),
          endISO: DateTime.fromJSDate(when.end).toISO(),
          ...(students.studentName
            ? { studentName: students.studentName }
            : {}),
          ...(students.studentNames
            ? { studentNames: students.studentNames }
            : {}),
        },
      });
      return;
    }

    if (action === "cancel") {
      // 取消通常没有教练名；靠时间+学员名匹配，必要时在 subject 里手动加 Coach 也能更稳
      if (!when.start) {
        res
          .status(400)
          .json({ ok: false, error: "Cancel parsed but start time missing" });
        return;
      }
      if (!students.studentName) {
        res
          .status(400)
          .json({ ok: false, error: "Cancel parsed but student name missing" });
        return;
      }

      const out = await cancelAppointmentStrict({
        when,
        studentName: students.studentName,
        coachIdHint: coachHint, // 如果有就加一个更严的约束
      });
      res.json({ ok: true, action, coachId: coachId ?? null, ...out });
      return;
    }

    // 改期先不做
    res
      .status(501)
      .json({ ok: false, error: "Change/reschedule not implemented yet" });
    return;
  } catch (err: any) {
    console.log("[ingest] error:", err);
    res.status(500).json({ ok: false, error: String(err?.message || err) });
    return;
  }
});
