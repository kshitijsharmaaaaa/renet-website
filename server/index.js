import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildSystemPrompt, createApp } from "./app.js";
import { createProviderFromEnv } from "./lib/ai.js";
import { parseTrustProxy } from "./lib/security.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const list = (value, fallback) =>
  (value || fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const positive = (value, fallback) => (Number(value) > 0 ? Number(value) : fallback);

const PORT = positive(env.PORT, 8787);

// The knowledge base is the single source of truth for the assistant.
// Edit server/knowledge/renet-knowledge.md and restart to update it.
const knowledge = readFileSync(path.join(here, "knowledge", "renet-knowledge.md"), "utf8").replace(
  /<!--[\s\S]*?-->/g,
  "",
);

const ai = createProviderFromEnv(env);

const app = createApp({
  ai,
  systemPrompt: buildSystemPrompt(knowledge),
  allowedOrigins: list(env.ALLOWED_ORIGINS, "http://localhost:5173,http://localhost:4173"),
  trustProxy: parseTrustProxy(env.TRUST_PROXY),
  leadsFile: path.resolve(here, env.LEADS_FILE || "data/leads.jsonl"),
  leadWebhook: { url: env.LEAD_WEBHOOK_URL, secret: env.LEAD_WEBHOOK_SECRET },
  adminToken: env.ADMIN_TOKEN || "",
  chatRateLimit: { windowMs: 60_000, max: positive(env.CHAT_RATE_LIMIT_PER_MIN, 15) },
  leadRateLimit: { windowMs: 10 * 60_000, max: positive(env.LEAD_RATE_LIMIT_PER_10_MIN, 5) },
  chatMaxInFlight: positive(env.CHAT_MAX_IN_FLIGHT, 10),
  aiTokenHeadroom: positive(env.AI_TOKEN_HEADROOM, 2500),
  // Optional: also serve the built website (run `npm run build` in the project root first).
  staticDir: env.STATIC_DIR ? path.resolve(here, env.STATIC_DIR) : null,
});

const server = app.listen(PORT, () => {
  console.log(`RENET API listening on http://localhost:${PORT}`);
  if (ai) {
    console.log(`AI assistant: ${ai.name} (${ai.model})`);
  } else {
    console.warn("No AI key set (GROQ_API_KEY) — /api/chat will return 503 until it is configured.");
  }
  if (!env.LEAD_WEBHOOK_URL) {
    console.warn("LEAD_WEBHOOK_URL is not set — leads are stored in server/data/leads.jsonl only (no notifications).");
  }
  if (env.STATIC_DIR) console.log(`Serving website from ${env.STATIC_DIR}`);
});

/*
  Production timeouts. keepAliveTimeout must exceed the load balancer's idle
  timeout (commonly 60 s) to avoid sporadic 502s; headersTimeout must exceed it.
  requestTimeout bounds slow uploads; AI calls are bounded separately (25 s).
*/
server.keepAliveTimeout = positive(env.KEEP_ALIVE_TIMEOUT_MS, 65_000);
server.headersTimeout = server.keepAliveTimeout + 1_000;
server.requestTimeout = 30_000;

// Graceful shutdown: stop accepting connections, let in-flight requests
// (including queued lead writes) finish, then exit. Hosts send SIGTERM on deploy.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — finishing in-flight requests…`);
  server.close(() => process.exit(0));
  server.closeIdleConnections();
  setTimeout(() => {
    console.warn("Forcing shutdown after 10 s.");
    process.exit(1);
  }, 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
