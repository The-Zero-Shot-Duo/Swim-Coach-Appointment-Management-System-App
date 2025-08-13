import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig"; // 确保路径正确
import { LessonEvent } from "../lib/types"; // 确保路径正确

/**
 * Fetches events from Firestore for a specific coach.
 * @param coachId The UID of the authenticated coach.
 * @returns A promise that resolves to an array of LessonEvent.
 */
export async function fetchCoachEvents(
  coachId: string
): Promise<LessonEvent[]> {
  // Log the intention to fetch from the real database
  console.log(`Fetching events from FIRESTORE for coach: ${coachId}`);

  if (!coachId) {
    console.error("Coach ID is missing, cannot fetch events.");
    return []; // 如果没有 coachId，直接返回空数组
  }

  // Reference to the 'lessons' collection in Firestore
  const lessonsCollectionRef = collection(db, "appointments");
  console.log("lessonsCollectionRef:", lessonsCollectionRef);
  // Create a query to find documents where 'extendedProps.coachId' matches the user's UID
  const q = query(
    lessonsCollectionRef,
    where("extendedProps.coachId", "==", coachId)
  );

  try {
    const querySnapshot = await getDocs(q);
    const events: LessonEvent[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log("Document data:", data);
      // Map the document data to the LessonEvent type
      // 注意：确保 Firestore 中的数据结构与你的 LessonEvent 类型匹配
      events.push({
        id: doc.id,
        title: data.title,
        start: data.start, // 假设 Firestore 中存储的是 ISO 格式的字符串
        end: data.end, // 假设 Firestore 中存储的是 ISO 格式的字符串
        extendedProps: data.extendedProps,
      } as LessonEvent); // Type assertion
    });

    console.log("Fetched events successfully from Firestore:", events);
    return events;
  } catch (error) {
    console.error("Error fetching events from Firestore:", error);
    // In case of an error, return an empty array to prevent the app from crashing
    return [];
  }
}
