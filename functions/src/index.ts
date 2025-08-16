// functions/src/index.ts

import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { db, Timestamp } from "./firebase"; // <-- IMPORT from new file
import { verifySignature, stripHtmlSafe, isPast } from "./utils";
import {
  parseAction,
  extractCoachHint,
  parseWhen,
  parseStudents,
  parseChangeDetails,
} from "./parsers";
import {
  findCoachIdByHint,
  upsertAppointment,
  updateAppointment,
  cancelAppointmentStrict,
} from "./database";

/**
 * @name ingestEmail
 * @description Main Firebase Cloud Function to handle incoming email webhooks.
 * It parses the email, determines the required action (book, cancel, change),
 * and performs the corresponding database operation.
 */
export const ingestEmail = onRequest(
  { cors: true, memory: "512MiB" },
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!(await verifySignature(req))) {
        res
          .status(401)
          .json({ ok: false, error: "Unauthorized (bad signature)" });
        return;
      }

      const raw: Record<string, unknown> = (req as any).body || {};
      const subject = (raw.subject as string) || "";
      const text = (raw.text as string) || stripHtmlSafe(raw.html);
      const html = ((raw.html ?? "") as string) || "";
      const messageId = ((raw.messageId ?? "") as string).toString();

      if (!messageId) {
        res.status(400).json({ ok: false, error: "Message-ID is missing." });
        return;
      }

      const ingestRef = db.collection("email_ingest").doc(messageId);
      const ingestSnap = await ingestRef.get();

      if (ingestSnap.exists && ingestSnap.data()?.status === "ok") {
        console.log(
          `[ingest] DUPLICATE message already processed, skip: ${messageId}`
        );
        res.status(208).json({
          ok: true,
          duplicate: true,
          reason: "Already processed successfully.",
        });
        return;
      }

      await ingestRef.set(
        { status: "processing", receivedAt: Timestamp.now(), payload: raw },
        { merge: true }
      );

      const action = parseAction(subject, text);
      const coachHint = extractCoachHint(subject, text, html);
      const coachId = await findCoachIdByHint(coachHint);

      console.log(
        `[ingest] action: ${action}, coachHint: ${
          coachHint ?? "null"
        }, coachId: ${coachId ?? "null"}`
      );

      const completeAsExpired = async (
        why: string,
        parsed: object
      ): Promise<void> => {
        await ingestRef.set(
          { status: "ok", action: "expired", reason: why },
          { merge: true }
        );
        res.status(200).json({ ok: true, expired: true, reason: why, parsed });
      };

      if (action === "book") {
        const when = parseWhen(subject, text, html);
        const students = parseStudents(subject, text);
        if (isPast(when.start))
          return await completeAsExpired("start time already past", {
            ...when,
            ...students,
          });

        if (!coachId || !when.start || !when.end || !students.studentName) {
          const error = `Book parsed with missing details.`;
          await ingestRef.set({ status: "error", error }, { merge: true });
          res.status(400).json({ ok: false, error });
          return;
        }

        const id = await upsertAppointment({
          coachId,
          subject,
          text,
          start: when.start,
          end: when.end,
          students,
          coachHint,
        });
        await ingestRef.set(
          { status: "ok", action: "book", appointmentId: id },
          { merge: true }
        );
        res.json({ ok: true, action, coachId, id });
        return;
      }

      if (action === "cancel") {
        const when = parseWhen(subject, text, html);
        const students = parseStudents(subject, text);
        if (isPast(when.start))
          return await completeAsExpired("start time already past", {
            ...when,
            ...students,
          });

        if (!when.start || !students.studentName) {
          const error = `Cancel parsed with missing details.`;
          await ingestRef.set({ status: "error", error }, { merge: true });
          res.status(400).json({ ok: false, error });
          return;
        }

        try {
          const out = await cancelAppointmentStrict({
            when,
            studentName: students.studentName,
            coachId,
          });
          await ingestRef.set(
            { status: "ok", action: "cancel", appointmentId: out.id },
            { merge: true }
          );
          res.json({ ok: true, action, ...out });
          return;
        } catch (e: any) {
          if (isPast(when.start))
            return await completeAsExpired("cancel failed but expired", {
              ...when,
              ...students,
            });
          await ingestRef.set(
            { status: "error", error: String(e?.message || e) },
            { merge: true }
          );
          res.status(400).json({ ok: false, error: String(e?.message || e) });
          return;
        }
      }

      if (action === "change") {
        const details = parseChangeDetails(text);
        if (isPast(details.start))
          return await completeAsExpired(
            "new start time already past",
            details
          );

        const changeCoachHint = details.coachHint || coachHint;
        const changeCoachId = await findCoachIdByHint(changeCoachHint || null);

        if (
          !details.studentName ||
          !details.start ||
          !details.end ||
          !changeCoachId
        ) {
          const error = `Change parsed with missing details: ${JSON.stringify({
            student: !!details.studentName,
            time: !!details.start,
            coach: !!changeCoachId,
          })}`;
          await ingestRef.set({ status: "error", error }, { merge: true });
          res.status(400).json({ ok: false, error });
          return;
        }

        try {
          const out = await updateAppointment({
            studentName: details.studentName,
            newCoachId: changeCoachId,
            newStart: details.start,
            newEnd: details.end,
            newCoachHint: changeCoachHint,
            newCourseName: details.courseName,
          });
          await ingestRef.set(
            { status: "ok", action: "change", appointmentId: out.id },
            { merge: true }
          );
          res.json({ ok: true, action, ...out });
          return;
        } catch (e: any) {
          await ingestRef.set(
            { status: "error", error: String(e?.message || e) },
            { merge: true }
          );
          res.status(400).json({ ok: false, error: String(e?.message || e) });
          return;
        }
      }

      const reason = `Unhandled action type: ${String(action)}`;
      await ingestRef.set({ status: "skipped", reason }, { merge: true });
      res.status(200).json({ ok: true, skipped: true, reason });
    } catch (err: any) {
      console.error("[ingest] top-level error:", err);
      const messageId = ((req as any).body?.messageId as string)?.toString();
      if (messageId) {
        await db
          .collection("email_ingest")
          .doc(messageId)
          .set(
            {
              status: "error",
              error: "Top-level exception: " + String(err?.message || err),
            },
            { merge: true }
          );
      }
      res.status(500).json({ ok: false, error: String(err?.message || err) });
    }
  }
);
