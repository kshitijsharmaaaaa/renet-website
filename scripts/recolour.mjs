/*
  Selective recolouring of the RENET D-8 White studio photo.

  Only the white painted body panels are changed. A pixel is treated as paint when
    (1) it lies inside the hand-traced scooter-body outline below, outside the
        cut-outs (rider's shoe/sock, headlight, mirrors …), and
    (2) it looks like white paint: bright enough and nearly colourless.
  Both tests are soft (feathered), so panel edges stay smooth.

  Recolouring keeps each pixel's own shading: the paint's lightness becomes a
  shade factor for the new colour, the photo's cool reflections are carried
  over, and the brightest glossy highlights stay white. Tyres, seat, trim,
  decals, lights, rider and background are untouched.

  Coordinates are pixels in public/renet-d8-white.png (1672 × 941).
  The result is a digital colour preview, not a factory photograph.
*/
import sharp from "sharp";

export const SOURCE = "public/renet-d8-white.png";

// Scooter body outline (painted areas live inside these polygons).
const INCLUDE = [
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
const EXCLUDE = [
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
async function regionMask(width, height) {
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
  return sharp(region, { raw: { width, height, channels: 1 } }).blur(1.5).extractChannel(0).raw().toBuffer();
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
export async function paintMask(input = SOURCE) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const region = await regionMask(width, height);
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
  return { data, width, height, weight };
}

export async function recolour(hex, input = SOURCE) {
  const { data, width, height, weight } = await paintMask(input);
  const target = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
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
