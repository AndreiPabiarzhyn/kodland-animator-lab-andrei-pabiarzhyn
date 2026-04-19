/** Tiny id helper */
export const uid = () => Math.random().toString(36).slice(2, 10);

/** Convert hex (#rrggbb or #rgb) to rgba() with optional alpha */
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

/** Create a blank PNG data URL of given size & background */
export const createBlankDataUrl = (
  width: number,
  height: number,
  bg: string = "transparent",
) => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  if (bg && bg !== "transparent") {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
  return c.toDataURL("image/png");
};

/** Promise-based image loader */
export const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Flood fill on an ImageData (4-conn, scanline) */
export const floodFill = (
  imageData: ImageData,
  x: number,
  y: number,
  fill: [number, number, number, number],
  tolerance = 0,
) => {
  const { data, width, height } = imageData;
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const idx = (y * width + x) * 4;
  const tr = data[idx], tg = data[idx + 1], tb = data[idx + 2], ta = data[idx + 3];

  if (
    tr === fill[0] && tg === fill[1] && tb === fill[2] && ta === fill[3]
  ) return;

  const matches = (i: number) => {
    const dr = data[i] - tr;
    const dg = data[i + 1] - tg;
    const db = data[i + 2] - tb;
    const da = data[i + 3] - ta;
    return (
      Math.abs(dr) <= tolerance &&
      Math.abs(dg) <= tolerance &&
      Math.abs(db) <= tolerance &&
      Math.abs(da) <= tolerance
    );
  };

  const stack: Array<[number, number]> = [[x, y]];
  while (stack.length) {
    const [sx, sy] = stack.pop()!;
    let nx = sx;
    let i = (sy * width + nx) * 4;
    // walk left
    while (nx >= 0 && matches(i)) {
      nx--;
      i -= 4;
    }
    nx++;
    i += 4;
    let spanUp = false;
    let spanDown = false;
    while (nx < width && matches(i)) {
      data[i] = fill[0];
      data[i + 1] = fill[1];
      data[i + 2] = fill[2];
      data[i + 3] = fill[3];
      // up
      if (sy > 0) {
        const ui = i - width * 4;
        if (matches(ui)) {
          if (!spanUp) {
            stack.push([nx, sy - 1]);
            spanUp = true;
          }
        } else if (spanUp) spanUp = false;
      }
      // down
      if (sy < height - 1) {
        const di = i + width * 4;
        if (matches(di)) {
          if (!spanDown) {
            stack.push([nx, sy + 1]);
            spanDown = true;
          }
        } else if (spanDown) spanDown = false;
      }
      nx++;
      i += 4;
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
