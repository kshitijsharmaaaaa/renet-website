import { test } from "node:test";
import assert from "node:assert/strict";
import { containsUnverifiedFigures, createProviderFromEnv, toPlainText } from "../lib/ai.js";

test("flags unpublished-style figures", () => {
  for (const text of [
    "It's priced at ₹79,999.",
    "Price: Rs. 85000 ex-showroom",
    "It has a 2.5 kWh battery.",
    "A 60V 30Ah pack",
    "Top speed is 65 km/h.",
    "It charges in 4 hours.",
    "Charging takes 3-4 hrs",
    "It comes with a 3 year warranty.",
    "Warranty covers 30,000 km... or 2 years",
    "It offers a range of 100 km.",
    "You can ride 90 km on a single charge.",
  ]) assert.ok(containsUnverifiedFigures(text), text);
});

test("does not block honest replies", () => {
  for (const text of [
    "The D-8 White has a single-light front; the D-8 Black has a double light.",
    "You ride 20–50 km a day. RENET hasn't published the D-8's range yet, so please confirm with the team.",
    "Message RENET on WhatsApp at +91 89294 01385 or email info@renet.in.",
    "Choose the design series 01 or 02 — both are the RENET D-8.",
    "Pricing hasn't been published yet. The team will share it when you enquire.",
    "Your daily ride is up to 20 km.",
  ]) assert.ok(!containsUnverifiedFigures(text), text);
});

test("strips Markdown to plain text", () => {
  assert.equal(toPlainText("**Bold** and `code`\n\n\n\n## Title\n- item"), "Bold and code\n\nTitle\n• item");
});

test("provider selection never activates without a key", () => {
  assert.equal(createProviderFromEnv({}), null);
  assert.equal(createProviderFromEnv({ AI_PROVIDER: "groq" }), null);
  const groq = createProviderFromEnv({ GROQ_API_KEY: "gsk_test" });
  assert.equal(groq.name, "groq");
  assert.equal(groq.model, "openai/gpt-oss-120b");
  assert.equal(createProviderFromEnv({ GROQ_API_KEY: "gsk_test", GROQ_MODEL: "qwen/qwen3.8-27b" }).model, "qwen/qwen3.8-27b");
});

test("normalises typographic hyphens and non-breaking spaces", () => {
  assert.equal(toPlainText("The D‑8 White and call‑back"), "The D-8 White and call-back");
  assert.equal(toPlainText("20–50 km"), "20–50 km", "en dashes in ranges are kept");
});

test("parses Groq reset durations", async () => {
  const { parseDurationSeconds } = await import("../lib/ai.js");
  assert.equal(parseDurationSeconds("45.33s"), 45.33);
  assert.equal(parseDurationSeconds("14m24s"), 864);
  assert.equal(parseDurationSeconds("1h2m3s"), 3723);
  assert.equal(parseDurationSeconds("250ms"), 0.25);
  assert.equal(parseDurationSeconds("12"), 12);
  assert.equal(parseDurationSeconds(""), null);
  assert.equal(parseDurationSeconds("soon"), null);
});
