/*
  Generates responsive WebP versions of the source photos in /public into
  src/assets/optimized/<name>-<width>.webp. Vite then content-hashes them,
  so they can be cached "immutable" for a year.

  Run after adding or replacing a photo:  npm run images
  Originals in /public are kept untouched (they are no longer referenced by the site).
*/
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { COLOURS, recolour } from "./recolour.mjs";

const root = path.resolve(import.meta.dirname, "..");
const OUT = path.join(root, "src/assets/optimized");

const SOURCES = {
  "renet-hero": { widths: [640, 960, 1280, 1672], quality: 72 },
  "renet-d8-white": { widths: [480, 960, 1280, 1672], quality: 74 },
  "renet-d8-black": { widths: [480, 960, 1280, 1672], quality: 74 },
  "renet-contact": { widths: [480, 960, 1280, 1672], quality: 72 },
  "renet-logo-transparent": { widths: [160, 320], quality: 82 },
};

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const [name, { widths, quality }] of Object.entries(SOURCES)) {
  const input = path.join(root, "public", `${name}.png`);
  const meta = await sharp(input).metadata();
  for (const width of widths.filter((w) => w <= meta.width)) {
    const file = path.join(OUT, `${name}-${width}.webp`);
    const info = await sharp(input).resize({ width }).webp({ quality, effort: 6, smartSubsample: true }).toFile(file);
    console.log(`${path.basename(file).padEnd(36)} ${String(Math.round(info.size / 1024)).padStart(5)} KB`);
  }
}
// Colour previews: the D-8 White and D-8 Black photos with only their painted
// panels recoloured (see scripts/recolour.mjs). Named renet-d8-<base>-<colour>-<width>.webp.
process.chdir(root);
for (const base of ["white", "black"]) for (const [id, hex] of Object.entries(COLOURS)) {
  const recoloured = await (await recolour(hex, base)).png().toBuffer();
  for (const width of SOURCES[`renet-d8-${base}`].widths) {
    const file = path.join(OUT, `renet-d8-${base}-${id}-${width}.webp`);
    const info = await sharp(recoloured).resize({ width }).webp({ quality: SOURCES[`renet-d8-${base}`].quality, effort: 6, smartSubsample: true }).toFile(file);
    console.log(`${path.basename(file).padEnd(36)} ${String(Math.round(info.size / 1024)).padStart(5)} KB`);
  }
}

console.log(`\n${(await readdir(OUT)).length} files written to src/assets/optimized/`);
