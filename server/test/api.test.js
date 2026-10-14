import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../app.js";

const ADMIN_TOKEN = "test-admin-token-0123456789abcdef";
const logs = [];
const logger = { error: (...args) => logs.push(args.join(" ")), warn() {}, log() {} };
let server, base, leadsFile, webhookServer, webhookHits;

const valid = {
  type: "test-ride",
  name: "Asha Verma",
  phone: "9876543210",
  city: "Pune",
  model: "D-8 Black",
  contactMethod: "call",
  consent: true,
};
const post = (body, headers = {}) =>
  fetch(`${base}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

before(async () => {
  leadsFile = path.join(await mkdtemp(path.join(tmpdir(), "renet-api-")), "leads.jsonl");
  // Webhook that always fails, to prove a failing notification never loses a lead.
  webhookHits = 0;
  webhookServer = createServer((req, res) => {
    webhookHits += 1;
    res.writeHead(500).end();
  }).listen(0);
  const app = createApp({
    leadsFile,
    adminToken: ADMIN_TOKEN,
    allowedOrigins: ["http://localhost:5173"],
    leadWebhook: { url: `http://127.0.0.1:${webhookServer.address().port}/hook` },
    leadRateLimit: { windowMs: 60_000, max: 6 },
    logger,
  });
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  webhookServer.close();
});

test("health reports configuration without secrets", async () => {
  const res = await fetch(`${base}/api/health`);
  assert.deepEqual(await res.json(), { ok: true, aiConfigured: false, leadsEnabled: true });
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-powered-by"), null);
});

test("valid lead → 201 only after it is stored; webhook failure is logged without PII", async () => {
  const res = await post(valid);
  assert.equal(res.status, 201);
  const { id } = await res.json();
  const stored = (await readFile(leadsFile, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(stored.at(-1).id, id);
  assert.equal(stored.at(-1).phone, "+919876543210");
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(webhookHits, 1);
  assert.ok(logs.some((l) => l.includes(id) && l.includes("webhook")));
  assert.ok(!logs.some((l) => l.includes("9876543210") || l.includes("Asha")), "no personal data in logs");
});

test("invalid lead → 400 with field errors and nothing stored", async () => {
  const before = (await readFile(leadsFile, "utf8")).length;
  const res = await post({ ...valid, phone: "123", consent: false });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.fields.phone && body.fields.consent);
  assert.equal((await readFile(leadsFile, "utf8")).length, before);
});

test("honeypot submissions are rejected, not silently accepted", async () => {
  const res = await post({ ...valid, company_url: "http://spam.example" });
  assert.equal(res.status, 400);
});

test("malformed JSON returns a JSON error, never a stack trace", async () => {
  const res = await fetch(`${base}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad" });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Invalid request." });
});

test("lead rate limit returns 429 with Retry-After", async () => {
  let last;
  for (let i = 0; i < 8; i++) last = await post(valid);
  assert.equal(last.status, 429);
  assert.ok(Number(last.headers.get("retry-after")) > 0);
});

test("admin export requires the bearer token and neutralises formulas in CSV", async () => {
  assert.equal((await fetch(`${base}/api/admin/leads`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/leads`, { headers: { Authorization: "Bearer wrong" } })).status, 401);
  const res = await fetch(`${base}/api/admin/leads?format=csv`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/csv/);
  assert.match(await res.text(), /^"?id"?,/);
});

test("CORS only for allowed origins; chat is 503 without an AI key", async () => {
  const ok = await fetch(`${base}/api/health`, { headers: { Origin: "http://localhost:5173" } });
  assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:5173");
  const bad = await fetch(`${base}/api/health`, { headers: { Origin: "https://evil.example" } });
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
  const chat = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) });
  assert.equal(chat.status, 503);
});

test("unknown API routes return JSON 404", async () => {
  const res = await fetch(`${base}/api/nope`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "Not found." });
});

test("chat sheds load with an immediate 503 when the in-flight cap is reached", async () => {
  // Fake AI provider that never answers until released.
  let release;
  const gate = new Promise((r) => (release = r));
  const slowAi = { name: "fake", model: "fake", complete: async () => { await gate; return { text: "ok" }; } };
  const app = createApp({ leadsFile, ai: slowAi, chatMaxInFlight: 2, chatRateLimit: { windowMs: 60_000, max: 1000 }, logger });
  const local = app.listen(0);
  const url = `http://127.0.0.1:${local.address().port}/api/chat`;
  const send = () => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }) });
  const first = [send(), send()];
  await new Promise((r) => setTimeout(r, 100));
  const started = Date.now();
  const third = await send();
  assert.equal(third.status, 503);
  assert.ok(Date.now() - started < 1000, "rejected immediately, not after a timeout");
  release();
  assert.deepEqual((await Promise.all(first)).map((r) => r.status), [200, 200]);
  assert.equal((await send()).status, 200, "capacity is released after requests finish");
  local.close();
});

// Spins up an app whose AI provider behaves as `complete` says.
async function chatWith(complete, messages = [{ role: "user", content: "Tell me about the D-8" }]) {
  const seen = [];
  const ai = { name: "fake", model: "fake", complete: async (input) => { seen.push(input); return complete(input); } };
  const app = createApp({ leadsFile, ai, systemPrompt: "SYSTEM", chatRateLimit: { windowMs: 60_000, max: 1000 }, logger });
  const local = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${local.address().port}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    return { status: res.status, body: await res.json(), seen };
  } finally {
    local.close();
  }
}

test("chat passes system prompt + validated history, and returns plain text", async () => {
  const { status, body, seen } = await chatWith(async () => ({ text: "## Hello\n**D-8 White** is clean and minimal." }), [
    { role: "assistant", content: "Welcome (UI-only, dropped)" },
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello!" },
    { role: "user", content: "Which is minimal?" },
  ]);
  assert.equal(status, 200);
  assert.equal(body.reply, "Hello\nD-8 White is clean and minimal.");
  assert.equal(seen[0].system, "SYSTEM");
  assert.deepEqual(seen[0].messages.map((m) => m.role), ["user", "assistant", "user"]);
});

test("provider errors map to safe messages — never fabricated replies, never internals", async () => {
  const cases = [["auth", 503], ["rate_limit", 429], ["timeout", 504], ["unavailable", 502], ["bad_request", 502]];
  for (const [kind, expected] of cases) {
    const { status, body } = await chatWith(async () => {
      const error = new Error("secret internal detail gsk_123");
      error.kind = kind;
      throw error;
    });
    assert.equal(status, expected, kind);
    assert.equal(body.reply, undefined);
    assert.ok(!JSON.stringify(body).includes("gsk_") && !JSON.stringify(body).includes("internal"), kind);
  }
});

test("empty or truncated AI output is an error, not a reply", async () => {
  assert.equal((await chatWith(async () => ({ text: "   " }))).status, 502);
  assert.equal((await chatWith(async () => ({ text: "The D-8 is", truncated: true }))).status, 502);
});

test("replies containing unpublished figures are replaced with an honest message", async () => {
  const { status, body } = await chatWith(async () => ({ text: "The D-8 costs ₹89,999 and goes 120 km per charge." }));
  assert.equal(status, 200);
  assert.equal(body.guarded, true);
  assert.match(body.reply, /hasn't published/);
  assert.ok(!/89,999|120 km/.test(body.reply));
});

// App whose AI provider is scripted per call; counts provider calls.
function scriptedApp(steps, extra = {}) {
  let calls = 0;
  const ai = {
    name: "fake",
    model: "fake",
    complete: async () => {
      const step = steps[Math.min(calls, steps.length - 1)];
      calls += 1;
      if (step instanceof Error) throw step;
      return step;
    },
  };
  const app = createApp({ leadsFile, ai, chatRateLimit: { windowMs: 60_000, max: 1000 }, logger, ...extra });
  const local = app.listen(0);
  const send = (content = "Tell me about the D-8") =>
    fetch(`http://127.0.0.1:${local.address().port}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content }] }),
    });
  return { send, calls: () => calls, close: () => local.close() };
}

test("after a provider 429, later requests are answered 'busy' without calling the provider", async () => {
  const limited = Object.assign(new Error("429"), { kind: "rate_limit", retryAfter: 30 });
  const t = scriptedApp([limited, { text: "ok" }]);
  assert.equal((await t.send()).status, 429);
  const second = await t.send();
  assert.equal(second.status, 429);
  assert.ok(Number(second.headers.get("retry-after")) > 20);
  assert.equal(t.calls(), 1, "no retry storm against the provider");
  t.close();
});

test("pauses proactively when the provider reports its token budget is nearly spent", async () => {
  const t = scriptedApp([{ text: "ok", rateLimit: { remainingTokens: 900, resetTokensSeconds: 20 } }, { text: "ok" }], { aiTokenHeadroom: 2500 });
  assert.equal((await t.send()).status, 200);
  assert.equal((await t.send()).status, 429);
  assert.equal(t.calls(), 1);
  t.close();
});

test("only the fixed suggestion questions are cached — other questions always reach the AI", async () => {
  const t = scriptedApp([{ text: "Both are the RENET D-8." }]);
  const q = "What's the difference between D-8 White and D-8 Black?";
  const first = await t.send(q);
  assert.equal(first.headers.get("x-cache"), "MISS");
  const second = await t.send(q);
  assert.equal(second.headers.get("x-cache"), "HIT");
  assert.equal((await second.json()).reply, "Both are the RENET D-8.");
  await t.send("My number is 9876543210, what's the D-8 like?");
  await t.send("My number is 9876543210, what's the D-8 like?");
  assert.equal(t.calls(), 3, "personal / free-form questions are never cached");
  t.close();
});

test("long conversations are trimmed to the most recent turns before reaching the AI", async () => {
  let seen;
  const ai = { name: "fake", model: "fake", complete: async (input) => ((seen = input), { text: "ok" }) };
  const app = createApp({ leadsFile, ai, chatRateLimit: { windowMs: 60_000, max: 1000 }, logger });
  const local = app.listen(0);
  const history = [];
  for (let i = 0; i < 19; i++) history.push({ role: i % 2 ? "assistant" : "user", content: `${i} `.padEnd(900, "x") });
  const res = await fetch(`http://127.0.0.1:${local.address().port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history }),
  });
  assert.equal(res.status, 200);
  const chars = seen.messages.reduce((n, m) => n + m.content.length, 0);
  assert.ok(chars <= 6000, `sent ${chars} chars`);
  assert.equal(seen.messages[0].role, "user");
  assert.ok(seen.messages.at(-1).content.startsWith("18 "), "most recent turn kept");
  local.close();
});

test("admin export is paginated, newest first", async () => {
  const res = await fetch(`${base}/api/admin/leads?limit=2&offset=0`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } });
  const body = await res.json();
  assert.equal(body.limit, 2);
  assert.ok(body.total >= 2);
  assert.equal(body.leads.length, 2);
  assert.ok(body.leads[0].createdAt >= body.leads[1].createdAt);
});
