/*
  Staged virtual-user load test for the RENET website + API.

  Each virtual user (VU) loops a realistic visit:
    GET /  → its JS/CSS bundles → GET /api/health → homepage images
    → think 2–5 s → GET /scooters/<model> → product images → think 3–6 s
    → 5% of iterations submit a test-ride request (POST /api/leads)
  The AI chat endpoint is deliberately NOT exercised (see loadtest.mjs and the
  README: AI capacity is bounded by the provider, tested separately).

  Usage (against a NON-production target — it creates test leads):
    node scripts/loadtest-journeys.mjs --site http://localhost:8787 \
      [--api <url>] [--stages 50,100,250,500,1000] [--stage-seconds 60] [--pids 123,456]
  --pids: local server process ids to sample CPU% / memory during the run.

  Start the target with a throw-away LEADS_FILE and a raised LEAD_RATE_LIMIT_PER_10_MIN
  (all VUs share one IP, so normal per-IP limits would reject them).
*/
import { execFileSync } from "node:child_process";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, i, all) => (value.startsWith("--") ? [...pairs, [value.slice(2), all[i + 1]]] : pairs), []),
);
const SITE = (args.site || "http://localhost:8787").replace(/\/$/, "");
const API = (args.api || SITE).replace(/\/$/, "");
const STAGES = (args.stages || "50,100,250,500,1000").split(",").map(Number);
const STAGE_SECONDS = Number(args["stage-seconds"] || 60);
const RAMP_SECONDS = Number(args["ramp-seconds"] || 10);
const PIDS = (args.pids || "").split(",").filter(Boolean);
const TIMEOUT_MS = 15_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (min, max) => min + Math.random() * (max - min);

// Discover the real asset URLs the way a browser would.
const html = await (await fetch(`${SITE}/`)).text();
const bundles = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]))];
let IMG = { hero: "/renet-hero.png", white: "/renet-d8-white.png", black: "/renet-d8-black.png", contact: "/renet-contact.png", logo: "/renet-logo-transparent.png" };
if (args.images === "webp") {
  // Optimized, content-hashed images are referenced from the JS bundle. Use the
  // 1280w versions — what a typical laptop/phone at 2x downloads.
  const js = (await Promise.all(bundles.filter((b) => b.endsWith(".js")).map(async (b) => (await fetch(SITE + b)).text()))).join("\n");
  const find = (name, width) => js.match(new RegExp(`/assets/${name}-${width}-[\\w-]+\\.webp`))?.[0];
  IMG = { hero: find("renet-hero", 1280), white: find("renet-d8-white", 1280), black: find("renet-d8-black", 1280), contact: find("renet-contact", 1280), logo: find("renet-logo-transparent", 320) };
  if (Object.values(IMG).some((url) => !url)) throw new Error(`Could not find optimized images in the bundle: ${JSON.stringify(IMG)}`);
}
console.log(`site ${SITE} | api ${API} | bundles: ${bundles.join(", ")} | images: ${args.images || "png"}`);

/* ---------- metrics ---------- */
let stats;
const resetStats = () => (stats = { byType: {}, bytes: 0, statusCounts: {}, timeouts: 0, netErrors: 0, start: Date.now() });
resetStats(); // ramp-up traffic is recorded too, then reset when each stage's hold begins
const record = (type, ms, status, bytes) => {
  const bucket = (stats.byType[type] ??= []);
  bucket.push(ms);
  stats.statusCounts[status] = (stats.statusCounts[status] || 0) + 1;
  stats.bytes += bytes;
};

async function hit(type, url, init = {}) {
  const started = performance.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await res.arrayBuffer();
    record(type, performance.now() - started, res.status, body.byteLength);
    return res.status;
  } catch (error) {
    if (error.name === "TimeoutError") stats.timeouts += 1;
    else {
      stats.netErrors += 1;
      stats.lastError ??= `${error.cause?.code || error.name}: ${error.cause?.message || error.message}`.slice(0, 120);
    }
    record(type, performance.now() - started, error.name === "TimeoutError" ? "timeout" : "neterr", 0);
    return 0;
  }
}

const lead = () =>
  JSON.stringify({ type: "test-ride", name: "Load Test", phone: "9876543210", city: "Pune", model: "D-8 White", contactMethod: "call", consent: true, source: "loadtest" });

/* ---------- virtual user ---------- */
let target = 0;
let active = 0;
async function virtualUser(id) {
  active += 1;
  // Browsers fetch a page's resources in parallel (6 connections per origin).
  while (id < target) {
    await hit("page", `${SITE}/`, { headers: { Accept: "text/html" } });
    await Promise.all([...bundles.map((b) => hit("asset", SITE + b)), hit("api-health", `${API}/api/health`)]);
    await Promise.all([hit("image", SITE + IMG.hero), hit("image", SITE + IMG.logo)]);
    await sleep(jitter(2000, 5000));
    if (id >= target) break;
    const model = Math.random() < 0.5 ? "d8-white" : "d8-black";
    await hit("page", `${SITE}/scooters/${model}`, { headers: { Accept: "text/html" } });
    await Promise.all([hit("image", SITE + (model === "d8-white" ? IMG.white : IMG.black)), hit("image", SITE + IMG.contact)]);
    if (Math.random() < 0.05) {
      await hit("api-lead", `${API}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: lead() });
    }
    await sleep(jitter(3000, 6000));
  }
  active -= 1;
}

/* ---------- resource sampling ---------- */
const samples = [];
const sampler = PIDS.length
  ? setInterval(() => {
      try {
        const out = execFileSync("ps", ["-o", "pid=,%cpu=,rss=", "-p", PIDS.join(",")]).toString().trim().split("\n");
        samples.push(out.map((l) => l.trim().split(/\s+/).map(Number)));
      } catch {}
    }, 2000)
  : null;

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);

/* ---------- run stages ---------- */
const report = [];
let launched = 0;
for (const vus of STAGES) {
  // Ramp to the stage's VU count, then hold.
  const startTarget = target;
  for (let s = 1; s <= RAMP_SECONDS; s++) {
    target = Math.round(startTarget + ((vus - startTarget) * s) / RAMP_SECONDS);
    while (launched < target) virtualUser(launched++);
    await sleep(1000);
  }
  samples.length = 0;
  resetStats();
  await sleep(STAGE_SECONDS * 1000);
  const seconds = (Date.now() - stats.start) / 1000;
  const all = Object.values(stats.byType).flat().sort((a, b) => a - b);
  const total = all.length;
  const errors5xx = Object.entries(stats.statusCounts).filter(([c]) => Number(c) >= 500).reduce((n, [, v]) => n + v, 0);
  const failed = stats.timeouts + stats.netErrors;
  const types = Object.fromEntries(
    Object.entries(stats.byType).map(([type, list]) => {
      const sorted = [...list].sort((a, b) => a - b);
      return [type, { n: sorted.length, p50: Math.round(pct(sorted, 50)), p95: Math.round(pct(sorted, 95)), p99: Math.round(pct(sorted, 99)) }];
    }),
  );
  const cpu = samples.length ? Math.max(...samples.map((s) => s.reduce((n, [, c]) => n + c, 0))) : null;
  const rssMb = samples.length ? Math.max(...samples.map((s) => s.reduce((n, [, , r]) => n + r, 0))) / 1024 : null;
  const row = {
    vus,
    activeVus: active,
    rps: Math.round(total / seconds),
    mbps: +((stats.bytes * 8) / 1e6 / seconds).toFixed(1),
    p50: Math.round(pct(all, 50)),
    p95: Math.round(pct(all, 95)),
    p99: Math.round(pct(all, 99)),
    errorRate5xx: +((errors5xx / Math.max(total, 1)) * 100).toFixed(2),
    failed,
    statusCounts: stats.statusCounts,
    peakCpuPct: cpu,
    peakRssMb: rssMb && Math.round(rssMb),
    types,
  };
  report.push(row);
  console.log(
    `\n[${vus} VUs] ${row.rps} req/s, ${row.mbps} Mbit/s | p50 ${row.p50} p95 ${row.p95} p99 ${row.p99} ms | 5xx ${row.errorRate5xx}% | timeouts+neterr ${failed}` +
      (cpu !== null ? ` | peak CPU ${cpu.toFixed(0)}% | peak RSS ${row.peakRssMb} MB` : ""),
  );
  for (const [type, t] of Object.entries(types)) console.log(`   ${type.padEnd(11)} n=${String(t.n).padEnd(7)} p50 ${t.p50}  p95 ${t.p95}  p99 ${t.p99} ms`);
  console.log(`   status: ${JSON.stringify(stats.statusCounts)}${stats.lastError ? ` | first network error: ${stats.lastError}` : ""}`);
}

target = 0;
if (sampler) clearInterval(sampler);
if (args.json) (await import("node:fs")).writeFileSync(args.json, JSON.stringify(report, null, 2));
console.log("\nDone. Waiting for VUs to finish their current step…");
const deadline = Date.now() + 20_000;
while (active > 0 && Date.now() < deadline) await sleep(500);
process.exit(0);
