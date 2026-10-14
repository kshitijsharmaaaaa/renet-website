import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import express from "express";

const COMPRESSED_TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
};

/*
  Optional: serve the built website (dist/) from this server.
  - /assets/* is content-hashed by Vite → cached for a year, immutable.
  - HTML → "no-cache" so every visit revalidates and picks up new deploys.
  - Other public files (favicon, original images) → one day.
  - Precompressed .br / .gz files (npm run build) are sent when the browser accepts them.
  - Unknown non-API paths fall back to index.html for client-side routes.
*/
export function staticSite(distDir) {
  const indexFile = path.join(distDir, "index.html");
  if (!existsSync(indexFile)) throw new Error(`STATIC_DIR has no index.html: ${distDir}`);
  const indexHtml = readFileSync(indexFile);
  const router = express.Router();

  router.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });

  // Precompressed variants
  router.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const ext = path.extname(req.path);
    const type = COMPRESSED_TYPES[ext];
    if (!type || req.path.includes("..")) return next();
    const accept = req.headers["accept-encoding"] || "";
    const file = path.join(distDir, req.path);
    for (const [encoding, suffix] of [["br", ".br"], ["gzip", ".gz"]]) {
      if (accept.includes(encoding) && existsSync(file + suffix) && statSync(file + suffix).isFile()) {
        res.setHeader("Content-Encoding", encoding);
        res.setHeader("Content-Type", type);
        res.setHeader("Vary", "Accept-Encoding");
        res.setHeader("Cache-Control", req.path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
        return res.sendFile(file + suffix);
      }
    }
    next();
  });

  router.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, filePath) {
        const relative = path.relative(distDir, filePath);
        if (relative.startsWith(`assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
        else res.setHeader("Cache-Control", "public, max-age=86400");
      },
    }),
  );

  // Client-side routes (/, /scooters/d8-white, …). Missing assets stay 404.
  router.get(/^(?!\/api\/|\/assets\/).*/, (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.type("html").send(indexHtml);
  });

  return router;
}
