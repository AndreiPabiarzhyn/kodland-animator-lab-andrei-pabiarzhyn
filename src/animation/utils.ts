/** Tiny id helper */
export const uid = () => Math.random().toString(36).slice(2, 10);

export const hexToRgba = (hex: string, a = 1) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export const hexToRgbArr = (hex: string): [number, number, number] => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/** Create a blank PNG data URL of given size (transparent) */
export const createBlankDataUrl = (width: number, height: number) => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c.toDataURL("image/png");
};

export const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/**
 * Robust flood fill with anti-aliased edge handling.
 *
 * 1. Scanline fill with a generous tolerance against the seed pixel (so
 *    semi-transparent / anti-aliased edges still get matched).
 * 2. Tracks the boolean "filled" mask, then dilates it by 1px to cover the
 *    last sub-pixel-thin AA ring that didn't fully match the tolerance.
 *    This is what eliminates the white halo around outlines.
 */
export const floodFill = (
  imageData: ImageData,
  x: number,
  y: number,
  fill: [number, number, number, number],
  tolerance = 48,
) => {
  const { data, width, height } = imageData;
  if (x < 0 || y < 0 || x >= width || y >= height) return;

  const seedIdx = (y * width + x) * 4;
  const sr = data[seedIdx];
  const sg = data[seedIdx + 1];
  const sb = data[seedIdx + 2];
  const sa = data[seedIdx + 3];

  // No-op if already exactly the fill color
  if (sr === fill[0] && sg === fill[1] && sb === fill[2] && sa === fill[3]) return;

  const filled = new Uint8Array(width * height);

  const matches = (i: number) => {
    const a = data[i + 3];
    // Treat fully transparent pixels as matching any other transparent pixel
    if (sa === 0 && a === 0) return true;
    // For alpha blending: weight diff by alpha so AA edges still match
    const dr = data[i] - sr;
    const dg = data[i + 1] - sg;
    const db = data[i + 2] - sb;
    const da = a - sa;
    return (
      Math.abs(dr) <= tolerance &&
      Math.abs(dg) <= tolerance &&
      Math.abs(db) <= tolerance &&
      Math.abs(da) <= tolerance
    );
  };

  const stack: number[] = [x, y];
  while (stack.length) {
    const sy = stack.pop()!;
    let nx = stack.pop()!;
    let i = (sy * width + nx) * 4;
    while (nx >= 0 && !filled[sy * width + nx] && matches(i)) {
      nx--;
      i -= 4;
    }
    nx++;
    i += 4;
    let spanUp = false;
    let spanDown = false;
    while (nx < width && !filled[sy * width + nx] && matches(i)) {
      filled[sy * width + nx] = 1;
      if (sy > 0) {
        const ui = i - width * 4;
        const upMatch = !filled[(sy - 1) * width + nx] && matches(ui);
        if (upMatch) {
          if (!spanUp) { stack.push(nx, sy - 1); spanUp = true; }
        } else if (spanUp) spanUp = false;
      }
      if (sy < height - 1) {
        const di = i + width * 4;
        const dnMatch = !filled[(sy + 1) * width + nx] && matches(di);
        if (dnMatch) {
          if (!spanDown) { stack.push(nx, sy + 1); spanDown = true; }
        } else if (spanDown) spanDown = false;
      }
      nx++;
      i += 4;
    }
  }

  // Dilate filled mask by 1px to cover anti-aliased outline rings.
  const dilated = new Uint8Array(filled);
  for (let y2 = 0; y2 < height; y2++) {
    for (let x2 = 0; x2 < width; x2++) {
      const idx = y2 * width + x2;
      if (filled[idx]) continue;
      // If any 4-neighbor is filled, mark as dilated (only paint if pixel is
      // not fully opaque of a different color — i.e. edge AA pixel).
      const left = x2 > 0 && filled[idx - 1];
      const right = x2 < width - 1 && filled[idx + 1];
      const up = y2 > 0 && filled[idx - width];
      const down = y2 < height - 1 && filled[idx + width];
      if (left || right || up || down) {
        const di = idx * 4;
        // Only fill the AA pixel if it is not a fully-opaque foreign color
        // (we don't want to repaint the user's outlines).
        if (data[di + 3] < 250) dilated[idx] = 1;
      }
    }
  }

  // Apply paint (alpha-blend onto original so AA edges blend nicely)
  for (let i = 0; i < dilated.length; i++) {
    if (!dilated[i]) continue;
    const di = i * 4;
    const dstA = data[di + 3] / 255;
    const srcA = fill[3] / 255;
    if (dstA === 0) {
      data[di] = fill[0];
      data[di + 1] = fill[1];
      data[di + 2] = fill[2];
      data[di + 3] = fill[3];
    } else {
      // Source-over composite
      const outA = srcA + dstA * (1 - srcA);
      data[di] = Math.round((fill[0] * srcA + data[di] * dstA * (1 - srcA)) / outA);
      data[di + 1] = Math.round((fill[1] * srcA + data[di + 1] * dstA * (1 - srcA)) / outA);
      data[di + 2] = Math.round((fill[2] * srcA + data[di + 2] * dstA * (1 - srcA)) / outA);
      data[di + 3] = Math.round(outA * 255);
    }
  }
};

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
