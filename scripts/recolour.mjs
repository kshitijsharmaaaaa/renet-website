/*
  Selective recolouring of the RENET D-8 studio photos (White and Black).

  WHITE photo — only the white painted body panels are changed. A pixel is paint when
    (1) it lies inside the hand-traced scooter-body outline below, outside the
        cut-outs (rider's shoe/sock, headlight, mirrors …), and
    (2) it looks like white paint: bright enough and nearly colourless.
  Both tests are soft (feathered), so panel edges stay smooth.

  Recolouring keeps each pixel's own shading: the paint's lightness becomes a
  shade factor for the new colour, the photo's cool reflections are carried
  over, and the brightest glossy highlights stay white. Tyres, seat, trim,
  decals, lights, rider and background are untouched.

  BLACK photo — black paint, black plastic and the seat look identical, so the
  painted panels are hand-traced (the same panels that are painted on the White
  design). Black paint is almost all reflection: the new colour goes underneath,
  lit by the photo's large-scale light falloff, and the original reflections are
  kept on top.

  Coordinates are pixels in the source photos (both 1672 × 941).
  Results are digital colour previews, not factory photographs.
*/
import sharp from "sharp";

export const SOURCE = "public/renet-d8-white.png";

// Scooter body outline (painted areas live inside these polygons).
const WHITE_INCLUDE = [
  // handlebar cowl (top edge traced below the rider's jacket)
  [[600, 300], [640, 288], [700, 281], [760, 289], [800, 305], [838, 315], [843, 345], [835, 366], [790, 368], [778, 370], [776, 390], [700, 390], [660, 376], [615, 350]],
  // leg shield, front fender and side body
  [
    [468, 702], [470, 640], [520, 578], [540, 470], [598, 378], [700, 380], [776, 390], [806, 384], [810, 420],
    [1000, 470], [1150, 420], [1172, 470], [1160, 560], [1100, 620], [1000, 682], [870, 762],
    [760, 806], [700, 802], [690, 722], [600, 706], [520, 706],
  ],
];

// Never recolour inside these (white non-paint parts).
const WHITE_EXCLUDE = [
  // rider's shoe and sock (traced)
  [[762, 708], [765, 680], [790, 650], [815, 630], [820, 605], [860, 605], [865, 630], [870, 660], [872, 690], [860, 705], [820, 710], [780, 712]],
  // indicator lenses on the handlebar cowl (clear lens + bulb)
  [[633, 350], [632, 320], [643, 307], [657, 310], [655, 337], [647, 353]],
  [[713, 361], [736, 333], [803, 319], [771, 357]],
  // black V-panel above the headlight (glossy black plastic, never paint)
  [[560, 470], [570, 440], [598, 408], [640, 394], [760, 390], [776, 396], [700, 462], [663, 482], [560, 478]],
  // headlight lens (traced)
  [[533, 560], [540, 515], [556, 478], [663, 483], [645, 512], [620, 542], [600, 572], [560, 584], [535, 582]],
  // rider's T-shirt / jacket visible under the handlebar
  [[805, 376], [900, 370], [900, 405], [812, 405], [806, 392]],
];

// D-8 Black (double light), traced along the bodywork on a brightened grid.
const BLACK_INCLUDE = [
  // front apron around the double headlights
  [[624, 392], [700, 396], [792, 404], [783, 428], [770, 470], [757, 520], [748, 565], [752, 604], [700, 606], [655, 600], [700, 560], [712, 503], [640, 498], [598, 490], [565, 490], [545, 470], [560, 440], [590, 410]],
  // narrow apron strip left of the headlights
  [[505, 592], [508, 540], [520, 500], [540, 476], [560, 492], [525, 520], [512, 560], [512, 592]],
  // front fender
  [[488, 692], [495, 656], [520, 633], [560, 621], [612, 623], [640, 641], [650, 668], [640, 690]],
  // side panel with the "D-8" decal
  [[900, 528], [960, 512], [1030, 494], [1080, 476], [1110, 466], [1135, 462], [1145, 478], [1130, 505], [1105, 535], [1075, 560], [1045, 582], [1000, 600], [950, 615], [905, 630], [898, 580]],
  // handlebar cowl
  [[655, 330], [690, 342], [795, 330], [830, 327], [856, 336], [850, 372], [760, 379], [668, 377], [650, 360]],
];

const BLACK_EXCLUDE = [
  // double headlights
  [[505, 600], [505, 520], [525, 490], [560, 500], [712, 503], [705, 550], [655, 592], [580, 602], [545, 602]],
  // daytime running light on the cowl
  [[694, 360], [704, 334], [800, 328], [806, 348], [760, 362]],
];

export const PROFILES = {
  white: { source: "public/renet-d8-white.png", include: WHITE_INCLUDE, exclude: WHITE_EXCLUDE, paint: "white" },
  black: { source: "public/renet-d8-black.png", include: BLACK_INCLUDE, exclude: BLACK_EXCLUDE, paint: "black" },
};

export const COLOURS = {
  grey: "#7c8184",
  "royal-blue": "#1d3fa6",
  "cherry-red": "#9e1b32",
};

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Region mask (0/1), then feathered with a blur so outline edges are soft.
async function regionMask(width, height, INCLUDE, EXCLUDE, feather = 1.5) {
  const region = Buffer.alloc(width * height);
  const boxes = INCLUDE.map((poly) => poly.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, 0, 0]));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = INCLUDE.some((poly, i) => {
        const [x0, y0, x1, y1] = boxes[i];
        return x >= x0 && x <= x1 && y >= y0 && y <= y1 && pointInPolygon(x, y, poly);
      });
      if (inside && !EXCLUDE.some((poly) => pointInPolygon(x, y, poly))) region[y * width + x] = 255;
    }
  }
  return sharp(region, { raw: { width, height, channels: 1 } }).blur(feather).extractChannel(0).raw().toBuffer();
}

// Square min/max filter on a 0/1 mask (separable) — erosion when max=false.
function morph(mask, width, height, radius, max) {
  const pass = (src, horizontal) => {
    const dst = new Uint8Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let v = max ? 0 : 1;
        for (let d = -radius; d <= radius; d++) {
          const xx = horizontal ? x + d : x;
          const yy = horizontal ? y : y + d;
          const s = xx < 0 || yy < 0 || xx >= width || yy >= height ? 0 : src[yy * width + xx];
          v = max ? Math.max(v, s) : Math.min(v, s);
        }
        dst[y * width + x] = v;
      }
    }
    return dst;
  };
  return pass(pass(mask, true), false);
}

// Labels 8-connected islands; returns [{ members: number[] }] for each.
function islands(mask, width, height) {
  const seen = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  const found = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let top = 0;
    const members = [];
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const i = stack[--top];
      members.push(i);
      const x = i % width;
      const y = (i - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (mask[j] && !seen[j]) {
            seen[j] = 1;
            stack[top++] = j;
          }
        }
      }
    }
    found.push(members);
  }
  return found;
}

/*
  Removes islands smaller than minArea — unless they sit within `near` px of a
  large painted panel (e.g. the paint showing inside the letters of "D-8").
*/
function cleanIslands(mask, width, height, { minArea, largeArea, near }) {
  const all = islands(mask, width, height);
  const large = new Uint8Array(mask.length);
  for (const members of all) if (members.length >= largeArea) for (const i of members) large[i] = 1;
  const nearLarge = morph(large, width, height, near, true);
  for (const members of all) {
    if (members.length >= minArea) continue;
    if (members.some((i) => nearLarge[i])) continue;
    for (const i of members) mask[i] = 0;
  }
  return mask;
}

/*
  Returns the per-pixel paint weight (0–1) as a Float32Array plus image data.
  Exported so the mask can be inspected (scripts can render it as an overlay).
*/
export async function paintMask(profileName = "white") {
  const profile = PROFILES[profileName];
  const { data, info } = await sharp(profile.source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  if (profile.paint === "black") {
    // Paint can't be told from plastic by colour here: use the traced panels,
    // feathered so their edges blend into the bodywork.
    const region = await regionMask(width, height, profile.include, profile.exclude, 2.2);
    // The studio background is blue-tinted; the scooter's black is neutral.
    const blueness = Buffer.alloc(width * height);
    for (let i = 0; i < blueness.length; i++) {
      const r = data[i * 3], b = data[i * 3 + 2];
      blueness[i] = Math.round(Math.max(0, Math.min(1, (b - r) / (b + 5))) * 255);
    }
    const blueSoft = await sharp(blueness, { raw: { width, height, channels: 1 } }).blur(2.5).extractChannel(0).raw().toBuffer();
    const weight = new Float32Array(width * height);
    for (let i = 0; i < weight.length; i++) {
      const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
      const max = Math.max(r, g, b) / 255;
      const sat = max === 0 ? 0 : (max - Math.min(r, g, b)) / 255 / max;
      // keep coloured parts (green logo, orange indicator) untouched
      weight[i] =
        (region[i] / 255) *
        (1 - smoothstep(0.3, 0.5, sat * smoothstep(0.08, 0.2, max))) *
        (1 - smoothstep(0.4, 0.52, blueSoft[i] / 255));
    }
    return { data, width, height, weight, profile };
  }
  const region = await regionMask(width, height, profile.include, profile.exclude);
  const core = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (region[i] < 128) continue;
    const r = data[i * 3] / 255;
    const g = data[i * 3 + 1] / 255;
    const b = data[i * 3 + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    // white paint (incl. its blue-ish shaded side): bright-ish and low saturation
    const paint = smoothstep(0.3, 0.45, max) * (1 - smoothstep(0.3, 0.44, sat));
    core[i] = paint > 0.5 ? 1 : 0;
  }
  // Drop isolated specks (grey reflections on black trim) but keep thin highlight
  // lines that belong to panels; a 1 px dilation then covers anti-aliased panel
  // edges so no pale outline remains.
  const cleaned = cleanIslands(core, width, height, { minArea: 80, largeArea: 2000, near: 6 });
  const grown = morph(cleaned, width, height, 1, true);
  for (let i = 0; i < grown.length; i++) grown[i] = grown[i] && region[i] ? 255 : 0;
  const soft = await sharp(Buffer.from(grown), { raw: { width, height, channels: 1 } }).blur(0.8).extractChannel(0).raw().toBuffer();
  const weight = new Float32Array(width * height);
  for (let i = 0; i < weight.length; i++) {
    // Never tint near-black pixels: keeps decals and lettering ("D-8") crisp.
    const max = Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]) / 255;
    weight[i] = (soft[i] / 255) * smoothstep(0.1, 0.22, max);
  }
  return { data, width, height, weight, profile };
}

export async function recolour(hex, profileName = "white") {
  const { data, width, height, weight, profile } = await paintMask(profileName);
  const target = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  if (profile.paint === "black") return recolourBlackPaint({ data, width, height, weight, target });
  // Brightness of the fully lit white panels in this photo (linear).
  const WHITE_REF = 0.92;
  const out = Buffer.from(data);
  for (let i = 0; i < width * height; i++) {
    const w = weight[i];
    if (w <= 0.001) continue;
    const lin = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]].map((v) => toLinear(v / 255));
    const luma = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    const shade = Math.min(1.15, luma / WHITE_REF);
    // glossy highlights stay white-ish
    const spec = smoothstep(0.97, 1.08, shade) * 0.55;
    for (let c = 0; c < 3; c++) {
      const tint = (lin[c] - luma) * 0.35; // carry over the studio's cool reflections
      const paint = Math.max(0, target[c] * shade + tint);
      const value = paint * (1 - spec) + lin[c] * spec;
      const mixed = lin[c] * (1 - w) + value * w;
      out[i * 3 + c] = Math.round(Math.min(1, Math.max(0, toSrgb(mixed))) * 255);
    }
  }
  return sharp(out, { raw: { width, height, channels: 3 } });
}

/*
  Black paint → new colour. Base colour underneath, lit by the photo's
  large-scale brightness of each panel (so panels facing the studio lights are
  brighter), with the original reflections added on top.
*/
async function recolourBlackPaint({ data, width, height, weight, target }) {
  const n = width * height;
  const masked = Buffer.alloc(n);
  const cover = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    const lin = [0, 1, 2].map((c) => toLinear(data[i * 3 + c] / 255));
    const luma = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    masked[i] = Math.round(Math.sqrt(Math.min(1, luma)) * 255 * Math.min(1, weight[i]));
    cover[i] = Math.round(Math.min(1, weight[i]) * 255);
  }
  const blur = (buf, sigma) => sharp(buf, { raw: { width, height, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer();
  const [avgWide, coverWide, avgNear, coverNear] = await Promise.all([blur(masked, 26), blur(cover, 26), blur(masked, 5), blur(cover, 5)]);
  const out = Buffer.from(data);
  for (let i = 0; i < n; i++) {
    const w = weight[i];
    if (w <= 0.001) continue;
    const wide = coverWide[i] ? (avgWide[i] / coverWide[i]) ** 2 : 0;
    const near = coverNear[i] ? (avgNear[i] / coverNear[i]) ** 2 : 0;
    // large-scale light falloff + a little local modelling of the surface
    const light = 0.2 + 0.7 * smoothstep(0.002, 0.07, wide) + 0.4 * smoothstep(0.004, 0.12, near);
    for (let c = 0; c < 3; c++) {
      const lin = toLinear(data[i * 3 + c] / 255);
      const value = target[c] * Math.min(1.25, light) * (1 - Math.min(1, lin)) + lin; // reflections on top
      const mixed = lin * (1 - w) + value * w;
      out[i * 3 + c] = Math.round(Math.min(1, Math.max(0, toSrgb(mixed))) * 255);
    }
  }
  return sharp(out, { raw: { width, height, channels: 3 } });
}
