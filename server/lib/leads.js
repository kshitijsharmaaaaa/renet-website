import { appendFile, chmod, mkdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export const LEAD_TYPES = ["test-ride", "enquiry"];
export const LEAD_MODELS = ["D-8 White", "D-8 Black", "Not sure yet"];
export const CONTACT_METHODS = ["call", "whatsapp", "email"];

const NAME_PATTERN = /^[\p{L}][\p{L}\p{M} .'-]{1,79}$/u;
const CITY_PATTERN = /^[\p{L}][\p{L}\p{M} .,'()-]{1,59}$/u;
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;

const clean = (value) => (typeof value === "string" ? value.normalize("NFC").replace(/\s+/g, " ").trim() : "");

// Indian mobile numbers: accepts "+91 98765 43210", "098765-43210", "9876543210".
export function normalizeIndianMobile(value) {
  const digits = String(value ?? "").replace(/[\s\-()]/g, "").replace(/^\+?91(?=\d{10}$)/, "").replace(/^0(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/*
  Server-side validation — the browser checks are only a convenience.
  Returns { lead } with normalised fields, or { errors } keyed by field.
*/
export function validateLead(body) {
  const input = body && typeof body === "object" ? body : {};
  const errors = {};

  const type = clean(input.type) || "test-ride";
  if (!LEAD_TYPES.includes(type)) errors.type = "Choose a valid request type.";

  const name = clean(input.name);
  if (!NAME_PATTERN.test(name)) errors.name = "Enter your name (2–80 letters).";

  const phone = normalizeIndianMobile(input.phone);
  if (!phone) errors.phone = "Enter a valid 10-digit Indian mobile number.";

  const city = clean(input.city);
  if (!CITY_PATTERN.test(city)) errors.city = "Enter your city.";

  const model = clean(input.model);
  if (!LEAD_MODELS.includes(model)) errors.model = "Choose a scooter model.";

  const contactMethod = clean(input.contactMethod);
  if (!CONTACT_METHODS.includes(contactMethod)) errors.contactMethod = "Choose how we should contact you.";

  const email = clean(input.email).toLowerCase();
  if (contactMethod === "email" && !EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  } else if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  const message = clean(input.message);
  if (message.length > 500) errors.message = "Keep your message under 500 characters.";

  if (input.consent !== true) errors.consent = "Please confirm RENET may contact you.";

  const source = clean(input.source).slice(0, 80);

  if (Object.keys(errors).length) return { errors };
  return {
    lead: { type, name, phone, city, model, contactMethod, email: email || null, message: message || null, source: source || null },
  };
}

/*
  Append-only JSON Lines store. Writes are batched: while one append is in
  flight, new leads queue up and are flushed together in the next single
  append, so concurrent submissions never interleave and a burst costs a few
  disk writes instead of one per lead. The file is created with owner-only
  permissions because it contains personal data.
*/
export function createLeadStore(filePath) {
  let ready = null;
  let pending = [];
  let flushing = null;

  const ensureFile = () => {
    ready ??= (async () => {
      await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
      await appendFile(filePath, "", { mode: 0o600 });
      await chmod(filePath, 0o600);
    })();
    return ready;
  };

  const flush = async () => {
    while (pending.length) {
      const batch = pending;
      pending = [];
      try {
        await ensureFile();
        await appendFile(filePath, batch.map((item) => item.line).join(""), { mode: 0o600 });
        batch.forEach((item) => item.resolve());
      } catch (error) {
        batch.forEach((item) => item.reject(error));
      }
    }
    flushing = null;
  };

  return {
    filePath,
    async save(lead) {
      const record = { id: randomUUID(), createdAt: new Date().toISOString(), ...lead };
      await new Promise((resolve, reject) => {
        pending.push({ line: `${JSON.stringify(record)}\n`, resolve, reject });
        flushing ??= flush();
      });
      return record;
    },
    async readAll() {
      await ensureFile();
      // Wait for any queued writes so exports include every confirmed lead.
      await flushing;
      const text = await readFile(filePath, "utf8");
      return text
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    },
  };
}

/*
  Optional notification (Zapier, Make, Google Apps Script, Slack, CRM…).
  Runs after the lead is safely stored; a failure here never loses the lead.
*/
export async function notifyWebhook(record, { url, secret, timeoutMs = 5000 }) {
  if (!url) return { skipped: true };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-Renet-Webhook-Secret": secret } : {}),
    },
    body: JSON.stringify({ event: "lead.created", lead: record }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Webhook responded ${response.status}`);
  return { delivered: true };
}

const CSV_COLUMNS = ["id", "createdAt", "type", "name", "phone", "city", "model", "contactMethod", "email", "message", "source"];

// CSV export with protection against spreadsheet formula injection.
export function leadsToCsv(records) {
  const cell = (value) => {
    let text = value == null ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [CSV_COLUMNS.join(","), ...records.map((record) => CSV_COLUMNS.map((key) => cell(record[key])).join(","))].join("\n");
}
