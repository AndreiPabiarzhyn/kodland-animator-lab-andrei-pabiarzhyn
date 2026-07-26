import { describe, expect, it } from "vitest";
import { floodFill, hexToRgbArr, rgbToHex } from "@/animation/utils";

describe("animation utilities", () => {
  it("converts colors between hex and RGB", () => {
    expect(hexToRgbArr("#3da9fc")).toEqual([61, 169, 252]);
    expect(hexToRgbArr("#abc")).toEqual([170, 187, 204]);
    expect(rgbToHex(61, 169, 252)).toBe("#3da9fc");
  });

  it("fills a connected canvas region without crossing an opaque border", () => {
    const image = {
      width: 5,
      height: 5,
      data: new Uint8ClampedArray(5 * 5 * 4),
    } as ImageData;
    for (let i = 0; i < image.data.length; i += 4) image.data[i + 3] = 255;
    for (let x = 1; x < 4; x++) {
      for (const y of [1, 3]) image.data[(y * 5 + x) * 4 + 2] = 255;
    }
    for (let y = 1; y < 4; y++) {
      for (const x of [1, 3]) image.data[(y * 5 + x) * 4 + 2] = 255;
    }

    floodFill(image, 2, 2, [255, 0, 0, 255], 0);

    expect(Array.from(image.data.slice((2 * 5 + 2) * 4, (2 * 5 + 2) * 4 + 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(image.data.slice((0 * 5 + 0) * 4, (0 * 5 + 0) * 4 + 4))).toEqual([0, 0, 0, 255]);
  });
});
