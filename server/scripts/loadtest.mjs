/*
  Load test for the RENET API.

  Usage (against a NON-production server — it creates test leads):
    node scripts/loadtest.mjs [baseUrl] [connections] [seconds]
    e.g. node scripts/loadtest.mjs http://localhost:8790 1000 20

  Start the target with a throw-away leads file and raised rate limits, e.g.:
    LEADS_FILE=/tmp/loadtest-leads.jsonl LEAD_RATE_LIMIT_PER_10_MIN=100000000 \
    CHAT_RATE_LIMIT_PER_MIN=100000000 PORT=8790 node index.js
  (All load comes from one IP, so normal per-IP limits would reject it.)

  /api/chat is only tested against a mock Anthropic endpoint
  (ANTHROPIC_BASE_URL) — never load-test the real paid API.
*/
import autocannon from "autocannon";

const [base = "http://localhost:8790", connections = "1000", seconds = "20"] = process.argv.slice(2);

const lead = JSON.stringify({
  type: "test-ride",
  name: "Load Test",
  phone: "9876543210",
  city: "Pune",
  model: "D-8 White",
  contactMethod: "call",
  consent: true,
  source: "loadtest",
});

const scenarios = [
  { name: "GET /api/health", path: "/api/health", method: "GET" },
  { name: "POST /api/leads (validate + durable write)", path: "/api/leads", method: "POST", body: lead },
  {
    name: "POST /api/chat (mock AI upstream)",
    path: "/api/chat",
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", content: "Tell me about the D-8 White" }] }),
  },
];

const only = process.env.SCENARIO;
for (const scenario of scenarios.filter((s) => !only || s.path.includes(only))) {
  const result = await autocannon({
    url: base + scenario.path,
    method: scenario.method,
    body: scenario.body,
    headers: { "content-type": "application/json" },
    connections: Number(connections),
    duration: Number(seconds),
    timeout: 10,
  });
  const codes = Object.entries(result.statusCodeStats || {})
    .map(([code, { count }]) => `${code}×${count}`)
    .join(" ");
  console.log(
    [
      `\n${scenario.name} — ${connections} concurrent connections, ${seconds}s`,
      `  requests: ${result.requests.total} total, ${Math.round(result.requests.average)}/s average`,
      `  latency ms: p50 ${result.latency.p50}, p90 ${result.latency.p90}, p99 ${result.latency.p99}, max ${result.latency.max}`,
      `  status codes: ${codes}`,
      `  errors: ${result.errors}, timeouts: ${result.timeouts}, non-2xx: ${result.non2xx}`,
    ].join("\n"),
  );
}
