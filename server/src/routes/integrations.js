import { Router } from "express";
import crypto from "node:crypto";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { requireAuth } from "../lib/auth.js";
import { sendEmail } from "../lib/email.js";

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// In-memory staging between UploadFile -> ExtractDataFromUploadedFile (single bulk-import flow, short-lived).
const uploads = new Map();
const UPLOAD_TTL_MS = 10 * 60 * 1000;

router.post("/upload-file", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  const id = crypto.randomUUID();
  uploads.set(id, { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype, expires: Date.now() + UPLOAD_TTL_MS });
  res.json({ file_url: `upload://${id}` });
});

// Parses a CSV file's rows against the given field list from json_schema.properties.
// (Only CSV is supported — a direct parser is enough since the schemas used in this
// app are simple, flat, header-driven rows.)
router.post("/extract-data", (req, res) => {
  const { file_url, json_schema } = req.body || {};
  const id = (file_url || "").replace("upload://", "");
  const entry = uploads.get(id);
  if (!entry) return res.json({ status: "error", details: "Uploaded file expired or not found. Please re-upload." });
  uploads.delete(id);

  const fields = Object.keys(json_schema?.properties || {});
  try {
    const text = entry.buffer.toString("utf-8");
    const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
    const output = records.map((row) => {
      const obj = {};
      for (const f of fields) if (row[f] !== undefined) obj[f] = row[f];
      return obj;
    });
    res.json({ status: "success", output });
  } catch (err) {
    res.json({ status: "error", details: "Could not parse file as CSV: " + err.message });
  }
});

router.post("/send-email", async (req, res) => {
  const { to, subject, body } = req.body || {};
  if (!to || !subject) return res.status(400).json({ error: "to and subject required" });
  const sent = await sendEmail({ to, subject, body: body || "" });
  res.json({ success: true, sent });
});

export default router;
