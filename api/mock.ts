// src/api/mock.ts

import { LessonEvent } from "../lib/types"; // 确保 types.ts 存在于 src/lib/

export async function fetchCoachEvents(
  coachId: string
): Promise<LessonEvent[]> {
  console.log(`Fetching events for coach: ${coachId}`);
  // 模拟网络延迟
  await new Promise((r) => setTimeout(r, 500));

  // 返回一些模拟数据
  return [
    {
      id: "evt_1",
      title: "Freestyle – Alice",
      start: "2025-08-14T10:00:00",
      end: "2025-08-14T11:00:00",
      extendedProps: {
        studentName: "Alice Chen",
        courseName: "Freestyle Basics",
        durationMin: 60,
        coachId,
        coachName: "Coach " + coachId,
        location: "Pool A",
        notes: "Focus on breathing rhythm",
      },
    },
    {
      id: "evt_2",
      title: "Backstroke – Ben",
      start: "2025-08-15T13:30:00",
      end: "2025-08-15T14:30:00",
      extendedProps: {
        studentName: "Ben Park",
        courseName: "Backstroke Intro",
        durationMin: 60,
        coachId,
        coachName: "Coach " + coachId,
        location: "Pool B",
      },
    },
  ];
}
