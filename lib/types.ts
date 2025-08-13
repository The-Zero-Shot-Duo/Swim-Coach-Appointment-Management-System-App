// src/lib/types.ts
export type LessonEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  extendedProps: {
    studentName: string;
    courseName: string;
    durationMin: number;
    coachId: string;
    coachName: string;
    location?: string;
    notes?: string;
    sourceEmailId?: string;
  };
};
