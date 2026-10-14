/*
  Writes .br and .gz copies of compressible build files in dist/ so the RENET
  server (SERVE_STATIC) can send them without compressing per request.
  CDN hosts (Vercel, Netlify, Cloudflare…) compress on their own and simply
  ignore these files.
*/
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const dist = path.resolve(import.meta.dirname, "../dist");
const COMPRESSIBLE = /\.(js|css|html|svg|json|txt|xml|map)$/;
let saved = 0;

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (COMPRESSIBLE.test(entry.name) && (await stat(file)).size > 1024) {
      const data = await readFile(file);
      const br = brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
      await writeFile(`${file}.br`, br);
      await writeFile(`${file}.gz`, gzipSync(data, { level: 9 }));
      saved += data.length - br.length;
    }
  }
}

await walk(dist);
console.log(`precompressed dist/ (brotli saves ${Math.round(saved / 1024)} KB)`);
