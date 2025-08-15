// functions/src/database.ts
import { DateTime } from "luxon";
import { AppointmentData } from "./types";
import { canon, generateStructuredNotes } from "./utils";
import { db, Timestamp, FieldValue } from "./firebase";

/**
 * Finds a coach's document ID by matching a name hint against their aliases.
 * @param {string | null} hint - The coach name hint to search for.
 * @returns {Promise<string | null>} The coach's document ID or null if not found.
 */
export async function findCoachIdByHint(
  hint: string | null
): Promise<string | null> {
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

/**
 * Creates or updates an appointment in Firestore.
 * @param {object} args - The appointment details.
 * @returns {Promise<string>} The document ID of the created/updated appointment.
 */
export async function upsertAppointment(args: {
  coachId: string;
  subject: string;
  text: string;
  start: Date;
  end: Date;
  students: { studentName?: string; studentNames?: string[] };
  coachHint: string | null;
}): Promise<string> {
  const { coachId, subject, start, end, students, coachHint } = args;
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
          : "Trial class",
        coachName: coachHint || "N/A",
        start,
        end,
      }),
      ...(students.studentName && { studentName: students.studentName }),
      ...(students.studentNames && { studentNames: students.studentNames }),
    },
    updatedAt: FieldValue.serverTimestamp(),
    ...(exists.empty && {
      createdAt: FieldValue.serverTimestamp(),
    }),
  };

  if (!exists.empty) {
    await exists.docs[0].ref.set(payload, { merge: true });
    return exists.docs[0].ref.id;
  }
  const docRef = await col.add(payload);
  return docRef.id;
}

/**
 * Updates an existing future appointment for a student.
 * @param {object} args - Details for the update.
 * @returns {Promise<{id: string, updated: boolean}>} The result of the update operation.
 */
export async function updateAppointment(args: {
  studentName: string;
  newCoachId: string;
  newStart: Date;
  newEnd: Date;
  newCoachHint: string | null;
}): Promise<{ id: string; updated: boolean }> {
  const { studentName, newCoachId, newStart, newEnd, newCoachHint } = args;
  const studentKey = canon(studentName);
  const col = db.collection("appointments");

  const snap = await col
    .where("startTS", ">=", Timestamp.now())
    .orderBy("startTS", "asc")
    .get();
  if (snap.empty)
    throw new Error(`Update failed: No future appointments found.`);

  const candidates = snap.docs
    .map((d) => ({ ref: d.ref, data: d.data() as AppointmentData }))
    .filter((x) => {
      const names: string[] = [];
      if (x.data.extendedProps?.studentName)
        names.push(x.data.extendedProps.studentName);
      if (x.data.studentName) names.push(x.data.studentName);
      if (x.data.extendedProps?.studentNames)
        names.push(...x.data.extendedProps.studentNames);
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
      studentName: oldData.extendedProps?.studentName || oldData.studentName,
      courseName: oldData.title?.includes("Private lesson")
        ? "Private lesson"
        : "Trial class",
      coachName: newCoachHint || "N/A",
      start: newStart,
      end: newEnd,
    }),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(
    `[update] Appointment ${appointmentToUpdate.ref.id} updated successfully.`
  );
  return { id: appointmentToUpdate.ref.id, updated: true };
}

/**
 * Deletes an appointment from Firestore based on strict matching criteria.
 * @param {object} args - Criteria for finding the appointment to cancel.
 * @returns {Promise<{id: string, deleted: boolean}>} The result of the deletion.
 */
export async function cancelAppointmentStrict(args: {
  when: { start?: Date };
  studentName: string;
  coachId?: string | null;
}): Promise<{ id: string; deleted: boolean }> {
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
    if (x.data.extendedProps?.studentNames)
      names.push(...x.data.extendedProps.studentNames);
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
      `Cancel failed: no appointment matched by time & student${
        coachId ? " & coach" : ""
      }.`
    );
  if (candidates.length > 1)
    throw new Error(
      `Cancel failed: multiple appointments matched by time & student${
        coachId ? " & coach" : ""
      }.`
    );

  await candidates[0].ref.delete();
  return { id: candidates[0].ref.id, deleted: true };
}
