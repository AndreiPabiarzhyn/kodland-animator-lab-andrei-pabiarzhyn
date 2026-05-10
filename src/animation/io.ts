import GIF from "gif.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Frame, Project } from "./types";
import { downloadBlob, loadImage } from "./utils";

const GIF_WORKER_URL = "/gif.worker.js";

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
    fctx.fillStyle = "#ffffff";
    fctx.fillRect(0, 0, W, H);
    fctx.drawImage(layer, 0, 0);
    composited.push(flat);
  }

  return new Promise((resolve, reject) => {
    try {
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: W,
        height: H,
        workerScript: GIF_WORKER_URL,
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
        const p = JSON.parse(String(reader.result));
        if (!p.frames || !Array.isArray(p.frames)) throw new Error("Invalid project file");
        resolve(p as Project);
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
