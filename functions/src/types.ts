// functions/src/types.ts

/**
 * @interface AppointmentData
 * @description Defines the structure of an appointment object as stored in Firestore.
 * This is used for type-checking when reading from or writing to the database.
 */
export interface AppointmentData {
  coachId: string;
  studentName?: string;
  title?: string;
  extendedProps?: {
    coachId?: string;
    studentName?: string;
    studentNames?: string[];
  };
}
