import GIF from "gif.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Frame, Project } from "./types";
import { downloadBlob, loadImage } from "./utils";

const GIF_WORKER_URL = "/gif.worker.js";

const isDataUrl = (value: unknown): value is string =>
  typeof value === "string" && /^data:image\/(png|jpeg|jpg|webp);base64,/.test(value);

const isValidProject = (value: unknown): value is Project => {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<Project>;
  if (
    typeof p.id !== "string" ||
    typeof p.name !== "string" ||
    !Number.isInteger(p.width) || p.width < 1 || p.width > 4096 ||
    !Number.isInteger(p.height) || p.height < 1 || p.height > 4096 ||
    typeof p.bgColor !== "string" ||
    !Number.isInteger(p.fps) || p.fps < 1 || p.fps > 120 ||
    typeof p.loop !== "boolean" ||
    !Number.isFinite(p.createdAt) || !Number.isFinite(p.updatedAt) ||
    !Array.isArray(p.frames) || p.frames.length === 0
  ) return false;

  return p.frames.every((frame) => {
    if (!frame || typeof frame !== "object") return false;
    const f = frame as Partial<Frame>;
    if (
      typeof f.id !== "string" ||
      typeof f.activeLayerId !== "string" ||
      !Number.isInteger(f.hold) || f.hold < 1 ||
      !Array.isArray(f.layers) || f.layers.length === 0
    ) return false;
    if (!f.layers.some((layer) => layer && layer.id === f.activeLayerId)) return false;

    return f.layers.every((layer) => {
      if (!layer || typeof layer !== "object") return false;
      const l = layer as Partial<Frame["layers"][number]>;
      return typeof l.id === "string" && typeof l.name === "string" &&
        typeof l.visible === "boolean" && isDataUrl(l.dataUrl);
    });
  });
};

/** Composite all visible layers of a frame into a fresh canvas (transparent). */
const compositeFrame = async (frame: Frame, w: number, h: number): Promise<HTMLCanvasElement> => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d")!;
  for (const layer of frame.layers) {
    if (!layer.visible) continue;
    try {
      const img = await loadImage(layer.dataUrl);
      ctx.drawImage(img, 0, 0);
    } catch { /* ignore */ }
  }
  return cv;
};

export const exportGif = async (
  project: Project,
  onProgress?: (p: number) => void,
): Promise<void> => {
  // Pre-composite every frame onto an opaque white background so GIF (which has
  // no real alpha) doesn't produce black/garbled frames.
  const W = project.width;
  const H = project.height;
  const composited: HTMLCanvasElement[] = [];
  for (const f of project.frames) {
    const layer = await compositeFrame(f, W, H);
    const flat = document.createElement("canvas");
    flat.width = W; flat.height = H;
    const fctx = flat.getContext("2d")!;
    // Fill background with the transparency key color (magenta). Pixels that
    // remain this exact color in the encoded frame become transparent in GIF.
    fctx.fillStyle = "#ff00ff";
    fctx.fillRect(0, 0, W, H);
    fctx.drawImage(layer, 0, 0);
    composited.push(flat);
  }

  return new Promise((resolve, reject) => {
    try {
      // Use a magenta key color so pixels that were transparent on the source
      // canvas remain transparent in the GIF (GIF only supports 1-bit alpha).
      const TRANSPARENT_KEY = 0xff00ff;
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: W,
        height: H,
        workerScript: GIF_WORKER_URL,
        transparent: TRANSPARENT_KEY,
      });
      const interval = Math.max(20, Math.round(1000 / Math.max(1, project.fps)));
      project.frames.forEach((f, i) => {
        gif.addFrame(composited[i], { copy: true, delay: interval * Math.max(1, f.hold) });
      });
      gif.on("progress", (p: number) => onProgress?.(p));
      gif.on("finished", (blob: Blob) => {
        downloadBlob(blob, `${project.name || "animation"}.gif`);
        resolve();
      });
      gif.render();
    } catch (e) {
      reject(e);
    }
  });
};

export const exportPngSequence = async (project: Project): Promise<void> => {
  const zip = new JSZip();
  for (let i = 0; i < project.frames.length; i++) {
    const cv = await compositeFrame(project.frames[i], project.width, project.height);
    const dataUrl = cv.toDataURL("image/png");
    const data = dataUrl.split(",")[1];
    zip.file(`frame_${String(i + 1).padStart(4, "0")}.png`, data, { base64: true });
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${project.name || "animation"}_frames.zip`);
};

export const saveProjectFile = (project: Project) => {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${project.name || "project"}.kodflip.json`);
};

export const loadProjectFile = (file: File): Promise<Project> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p: unknown = JSON.parse(String(reader.result));
        if (!isValidProject(p)) throw new Error("Invalid project file");
        resolve(p);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });

export const importImageAsFrame = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
