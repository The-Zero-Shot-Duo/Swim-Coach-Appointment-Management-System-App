// api/mock.ts
import {
  collection,
  collectionGroup,
  query,
  where,
  getDocs,
  FieldPath,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { LessonEvent } from "../lib/types";

/**
 * 安全转换各种时间类型
 * - Firestore Timestamp → Date
 * - Date → Date
 * - String → Date
 */
const toDate = (v: any): Date =>
  v?.toDate ? v.toDate() : v instanceof Date ? v : new Date(v);

/** 转成 ISO 字符串（统一格式，方便 UI 使用） */
const toIso = (v: any): string => toDate(v).toISOString();

export async function fetchCoachEvents(
  coachIdRaw: string
): Promise<LessonEvent[]> {
  const coachId = coachIdRaw?.trim();
  console.log("[FS] fetchCoachEvents enter. coachId:", JSON.stringify(coachId));

  const events: LessonEvent[] = [];

  /** 0) 扫描顶层集合，输出样本，方便调试 */
  try {
    const scan = await getDocs(collection(db, "appointments"));
    let i = 0;
    console.log("[FS][scan top] size:", scan.size);
    scan.forEach((doc) => {
      if (i++ < 5) {
        const d = doc.data() as any;
        console.log("[FS][scan top] sample:", doc.id, {
          keys: Object.keys(d),
          coachId: d.coachId,
          extCoachId: d?.extendedProps?.coachId,
          types: {
            coachId: typeof d.coachId,
            ext: typeof d?.extendedProps?.coachId,
          },
        });
      }
    });
  } catch (e) {
    console.warn("[FS][scan top] error:", e);
  }

  try {
    /** 1) 顶层集合 → coachId */
    const q1 = query(
      collection(db, "appointments"),
      where("coachId", "==", coachId)
    );
    const s1 = await getDocs(q1);
    console.log("[FS] top coachId size:", s1.size);
    s1.forEach((d) => events.push({ id: d.id, ...(d.data() as any) }));

    /** 2) 顶层集合 → extendedProps.coachId */
    if (events.length === 0) {
      const q2 = query(
        collection(db, "appointments"),
        where(new FieldPath("extendedProps", "coachId"), "==", coachId)
      );
      const s2 = await getDocs(q2);
      console.log("[FS] top nested extProps size:", s2.size);
      s2.forEach((d) => events.push({ id: d.id, ...(d.data() as any) }));
    }

    /** 3) 如果还没结果，用 collectionGroup 跨路径兜底 */
    if (events.length === 0) {
      const g1 = query(
        collectionGroup(db, "appointments"),
        where("coachId", "==", coachId)
      );
      const gs1 = await getDocs(g1);
      console.log("[FS] group coachId size:", gs1.size);
      gs1.forEach((d) => events.push({ id: d.id, ...(d.data() as any) }));

      if (events.length === 0) {
        const g2 = query(
          collectionGroup(db, "appointments"),
          where(new FieldPath("extendedProps", "coachId"), "==", coachId)
        );
        const gs2 = await getDocs(g2);
        console.log("[FS] group nested extProps size:", gs2.size);
        gs2.forEach((d) => events.push({ id: d.id, ...(d.data() as any) }));
      }
    }

    console.log("[FS] raw events count:", events.length);

    /** 4) 统一 start/end 字段为 ISO 字符串，避免 UI 层类型不一致 */
    const normalized: LessonEvent[] = events.map((e: any) => ({
      ...e,
      start: toIso(e.start),
      end: toIso(e.end),
      extendedProps: {
        ...(e.extendedProps ?? {}),
        coachId: e.extendedProps?.coachId ?? e.coachId ?? "",
      },
    }));

    console.log("[FS] normalized events count:", normalized.length);
    return normalized;
  } catch (err) {
    console.error("[FS] fetchCoachEvents error:", err);
    throw err;
  }
}
