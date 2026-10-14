import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { createApp } from "../app.js";

test("static site: immutable hashed assets, revalidated HTML, precompressed files, SPA routes", async () => {
  const dist = await mkdtemp(path.join(tmpdir(), "renet-dist-"));
  await mkdir(path.join(dist, "assets"));
  const js = "console.log('renet');".repeat(100);
  await writeFile(path.join(dist, "index.html"), "<!doctype html><title>RENET</title>");
  await writeFile(path.join(dist, "assets", "index-abc123.js"), js);
  await writeFile(path.join(dist, "assets", "index-abc123.js.br"), brotliCompressSync(js));
  await writeFile(path.join(dist, "assets", "index-abc123.js.gz"), gzipSync(js));
  await writeFile(path.join(dist, "favicon.svg"), "<svg/>");

  const app = createApp({ leadsFile: path.join(dist, "leads.jsonl"), staticDir: dist });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const html = await fetch(`${base}/scooters/d8-white`);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /RENET/);
    assert.equal(html.headers.get("cache-control"), "no-cache");
    assert.equal(html.headers.get("content-security-policy"), null, "API CSP must not break the site");

    const asset = await fetch(`${base}/assets/index-abc123.js`, { headers: { "Accept-Encoding": "br, gzip" } });
    assert.equal(asset.headers.get("content-encoding"), "br");
    assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(await asset.text(), js, "decompressed content matches");

    const gz = await fetch(`${base}/assets/index-abc123.js`, { headers: { "Accept-Encoding": "gzip" } });
    assert.equal(gz.headers.get("content-encoding"), "gzip");

    assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404, "missing assets are not masked by index.html");
    assert.equal((await fetch(`${base}/favicon.svg`)).headers.get("cache-control"), "public, max-age=86400");

    const api = await fetch(`${base}/api/nope`);
    assert.equal(api.status, 404);
    assert.match(api.headers.get("content-security-policy"), /default-src 'none'/);
  } finally {
    server.close();
  }
});
