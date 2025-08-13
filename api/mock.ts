// api/mock.ts
import {
  collection,
  query,
  where,
  getDocs,
  FieldPath,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { LessonEvent } from "../lib/types";

/** 统一把 Firestore Timestamp / string / Date 转成 Date */
const toDate = (v: any): Date =>
  v?.toDate ? v.toDate() : v instanceof Date ? v : new Date(v);

/** 安全拿 ISO；遇到非法时间就回退到当前时间，避免崩溃 */
const toIso = (v: any): string => {
  const d = toDate(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

export async function fetchCoachEvents(
  coachIdRaw: string
): Promise<LessonEvent[]> {
  const coachId = coachIdRaw?.trim();
  console.log("[FS] fetchCoachEvents enter. coachId:", JSON.stringify(coachId));
  if (!coachId) return [];

  const buf: any[] = [];

  // 1) 顶层集合 appointments → coachId
  const q1 = query(
    collection(db, "appointments"),
    where("coachId", "==", coachId)
  );
  const s1 = await getDocs(q1);
  s1.forEach((d) => buf.push({ id: d.id, ...d.data() }));

  // 2) 顶层集合 appointments → extendedProps.coachId（兼容老数据）
  if (buf.length === 0) {
    const q2 = query(
      collection(db, "appointments"),
      where(new FieldPath("extendedProps", "coachId"), "==", coachId)
    );
    const s2 = await getDocs(q2);
    s2.forEach((d) => buf.push({ id: d.id, ...d.data() }));
  }

  console.log("[FS] raw events count:", buf.length);

  // 3) 统一时间 & 字段并按开始时间排序（前端不再调 startsWith）
  const events: LessonEvent[] = buf
    .map((e: any) => ({
      id: e.id,
      title: e.title ?? "",
      start: toIso(e.start),
      end: toIso(e.end ?? e.start),
      extendedProps: {
        ...(e.extendedProps ?? {}),
        coachId: e?.extendedProps?.coachId ?? e?.coachId ?? coachId,
      },
    }))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  console.log("[FS] normalized events count:", events.length);
  return events;
}
