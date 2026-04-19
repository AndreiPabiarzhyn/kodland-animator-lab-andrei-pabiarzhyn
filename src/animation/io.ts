import GIF from "gif.js";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Project } from "./types";
import { downloadBlob, loadImage } from "./utils";

// gif.js worker is loaded from a CDN URL — bundling its worker as an asset
// is awkward in Vite. We use the official jsdelivr URL which has CORS enabled.
const GIF_WORKER_URL = "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js";

export const exportGif = async (
  project: Project,
  onProgress?: (p: number) => void,
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const gif = new GIF({
        workers: 2,
        quality: 8,
        width: project.width,
        height: project.height,
        workerScript: GIF_WORKER_URL,
        background: project.bgColor === "transparent" ? "#ffffff" : project.bgColor,
      });

      const tmp = document.createElement("canvas");
      tmp.width = project.width;
      tmp.height = project.height;
      const tctx = tmp.getContext("2d")!;

      const interval = Math.round(1000 / project.fps);

      for (const f of project.frames) {
        const img = await loadImage(f.dataUrl);
        tctx.clearRect(0, 0, tmp.width, tmp.height);
        if (project.bgColor && project.bgColor !== "transparent") {
          tctx.fillStyle = project.bgColor;
          tctx.fillRect(0, 0, tmp.width, tmp.height);
        }
        tctx.drawImage(img, 0, 0);
        gif.addFrame(tmp, { copy: true, delay: interval * f.hold });
      }

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
    const f = project.frames[i];
    const data = f.dataUrl.split(",")[1];
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
