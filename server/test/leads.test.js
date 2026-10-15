import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLeadStore, leadsToCsv, normalizeIndianMobile, validateLead } from "../lib/leads.js";

const valid = {
  type: "test-ride",
  name: "Asha Verma",
  phone: "+91 98765 43210",
  city: "Pune",
  model: "D-8 White",
  contactMethod: "whatsapp",
  consent: true,
};

test("normalises Indian mobile formats", () => {
  assert.equal(normalizeIndianMobile("9876543210"), "+919876543210");
  assert.equal(normalizeIndianMobile("+91 98765-43210"), "+919876543210");
  assert.equal(normalizeIndianMobile("098765 43210"), "+919876543210");
  assert.equal(normalizeIndianMobile("1234567890"), null, "must start with 6–9");
  assert.equal(normalizeIndianMobile("98765"), null);
  assert.equal(normalizeIndianMobile(undefined), null);
});

test("accepts a valid lead and normalises it", () => {
  const { lead, errors } = validateLead({ ...valid, name: "  Asha   Verma " });
  assert.equal(errors, undefined);
  assert.equal(lead.name, "Asha Verma");
  assert.equal(lead.phone, "+919876543210");
  assert.equal(lead.email, null);
});

test("rejects invalid fields with per-field errors", () => {
  const { errors } = validateLead({ ...valid, name: "A", phone: "12", city: "", model: "D-9", contactMethod: "fax", consent: false });
  assert.deepEqual(Object.keys(errors).sort(), ["city", "consent", "contactMethod", "model", "name", "phone"]);
});

test("requires an email only when email is the contact method", () => {
  assert.ok(validateLead({ ...valid, contactMethod: "email" }).errors.email);
  assert.equal(validateLead({ ...valid, contactMethod: "email", email: "asha@example.com" }).errors, undefined);
  assert.ok(validateLead({ ...valid, email: "not-an-email" }).errors.email);
});

test("rejects oversized messages and non-object bodies", () => {
  assert.ok(validateLead({ ...valid, message: "x".repeat(501) }).errors.message);
  assert.ok(validateLead(null).errors);
  assert.ok(validateLead("text").errors);
});

test("CSV export neutralises spreadsheet formulas and escapes quotes", () => {
  const csv = leadsToCsv([{ id: "1", name: '=HYPERLINK("x")', message: 'say "hi"', phone: "+919876543210" }]);
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.match(csv, /"say ""hi"""/);
  assert.match(csv, /"'\+919876543210"/);
});

test("store writes concurrent leads without interleaving, with owner-only permissions", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "renet-leads-"));
  const store = createLeadStore(path.join(dir, "nested", "leads.jsonl"));
  const { lead } = validateLead(valid);
  await Promise.all(Array.from({ length: 200 }, (_, i) => store.save({ ...lead, city: `City ${i}` })));
  const lines = (await readFile(store.filePath, "utf8")).trim().split("\n");
  assert.equal(lines.length, 200);
  lines.forEach((line) => JSON.parse(line)); // every line is complete JSON
  assert.equal(new Set(lines.map((l) => JSON.parse(l).id)).size, 200);
  assert.equal((await stat(store.filePath)).mode & 0o777, 0o600);
  assert.equal((await store.readAll()).length, 200);
});

test("a failed write rejects the save (never reported as stored)", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "renet-leads-"));
  // Parent path is a file, so the leads file can never be created.
  const blocker = path.join(dir, "blocker");
  await (await import("node:fs/promises")).writeFile(blocker, "x");
  const store = createLeadStore(path.join(blocker, "leads.jsonl"));
  const { lead } = validateLead(valid);
  await assert.rejects(store.save(lead));
});

test("colour is optional and must be one of the five D-8 colours", () => {
  assert.equal(validateLead(valid).lead.colour, null);
  assert.equal(validateLead({ ...valid, colour: "Royal Blue" }).lead.colour, "Royal Blue");
  assert.ok(validateLead({ ...valid, colour: "Purple" }).errors.colour);
  assert.match(leadsToCsv([{ id: "1", colour: "Cherry Red" }]).split("\n")[0], /"?colour"?/);
});
