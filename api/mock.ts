// api/mock.ts (现在是连接到 Firebase)

import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig"; // 导入我们的数据库实例
import { LessonEvent } from "../lib/types";

export async function fetchCoachEvents(
  coachId: string
): Promise<LessonEvent[]> {
  console.log(`Fetching events from FIRESTORE for coach: ${coachId}`);

  const events: LessonEvent[] = [];
  try {
    // 1. 创建一个查询 (query)
    // - 'appointments' 是你的集合名称
    // - where("extendedProps.coachId", "==", coachId) 是查询条件
    const q = query(
      collection(db, "appointments"),
      where("extendedProps.coachId", "==", coachId)
    );

    // 2. 执行查询
    const querySnapshot = await getDocs(q);

    // 3. 遍历查询结果
    querySnapshot.forEach((doc) => {
      // doc.data() 是文档的内容
      // 我们把它转换为 LessonEvent 类型
      events.push(doc.data() as LessonEvent);
    });

    console.log("Fetched events successfully:", events);
    return events;
  } catch (error) {
    console.error("Error fetching events from Firestore: ", error);
    // 如果出错，返回一个空数组
    return [];
  }
}
