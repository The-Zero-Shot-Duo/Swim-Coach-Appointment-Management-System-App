// functions/src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";

type EmailPayload = {
  subject?: string;
  text?: string;
  html?: string;
  data?: unknown;
  event?: unknown;
};

function normalizeBody(raw: unknown): EmailPayload {
  const out: EmailPayload = {};
  if (!raw || typeof raw !== "object") return out;

  const o = raw as Record<string, unknown>;

  // 直挂字段
  if (typeof o.subject === "string") out.subject = o.subject;
  if (typeof o.text === "string") out.text = o.text;
  if (typeof o.html === "string") out.html = o.html;

  // 有些平台把真实数据放 data 里
  if (!out.subject || !out.text || !out.html) {
    const d = o.data;
    if (d && typeof d === "object") {
      const dd = d as Record<string, unknown>;
      if (!out.subject && typeof dd.subject === "string")
        out.subject = dd.subject;
      if (!out.text && typeof dd.text === "string") out.text = dd.text;
      if (!out.html && typeof dd.html === "string") out.html = dd.html;
    }
  }

  // 也可能放在 event 里（可选）
  if (!out.subject || !out.text || !out.html) {
    const e = o.event;
    if (e && typeof e === "object") {
      const ee = e as Record<string, unknown>;
      if (!out.subject && typeof ee.subject === "string")
        out.subject = ee.subject;
      if (!out.text && typeof ee.text === "string") out.text = ee.text;
      if (!out.html && typeof ee.html === "string") out.html = ee.html;
    }
  }

  return out;
}

export const ingestEmail = onRequest(
  { cors: true },
  (req: Request, res: Response) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Use POST" });
      return;
    }

    const body = normalizeBody(req.body as unknown);
    const { subject, text, html } = body;

    if (!subject && !text && !html) {
      res.status(400).json({
        ok: false,
        error:
          "No subject/text/html found. Ensure Content-Type: application/json and body has proper fields.",
      });
      return;
    }

    // 先回显，后续再落库
    res.json({
      ok: true,
      received: {
        subject: subject ?? null,
        textLen: text?.length ?? 0,
        htmlLen: html?.length ?? 0,
      },
    });
  }
);
