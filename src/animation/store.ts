import { create } from "zustand";
import { Frame, Layer, OnionSettings, Project, ToolSettings } from "./types";
import { createBlankDataUrl, uid } from "./utils";

const STORAGE_KEY = "kodflip:project:v2";

const makeLayer = (name: string, w: number, h: number): Layer => ({
  id: uid(),
  name,
  visible: true,
  dataUrl: createBlankDataUrl(w, h),
});

const makeFrame = (w: number, h: number): Frame => {
  const l = makeLayer("Layer 1", w, h);
  return { id: uid(), layers: [l], activeLayerId: l.id, hold: 1 };
};

const defaultProject = (): Project => {
  const w = 800, h = 600;
  return {
    id: uid(),
    name: "My Animation",
    width: w,
    height: h,
    bgColor: "transparent",
    fps: 12,
    loop: true,
    frames: [makeFrame(w, h)],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

type LayerHistoryEntry = { frameId: string; layerId: string; dataUrl: string };

interface AppState {
  project: Project;
  currentFrame: number;
  tool: ToolSettings;
  onion: OnionSettings;
  isPlaying: boolean;

  /** Per-layer history (snapshots before edit) */
  history: Record<string, string[]>;
  future: Record<string, string[]>;

  // setters
  setTool: (patch: Partial<ToolSettings>) => void;
  setOnion: (patch: Partial<OnionSettings>) => void;
  setProjectMeta: (patch: Partial<Project>) => void;

  // frame ops
  setCurrentFrame: (i: number) => void;
  addFrame: () => void;
  duplicateFrame: (i?: number) => void;
  deleteFrame: (i?: number) => void;
  moveFrame: (from: number, to: number) => void;
  setFrameHold: (i: number, hold: number) => void;

  // layer ops (operate on current frame)
  addLayer: () => void;
  duplicateLayer: (layerId?: string) => void;
  deleteLayer: (layerId?: string) => void;
  moveLayer: (from: number, to: number) => void;
  renameLayer: (layerId: string, name: string) => void;
  toggleLayerVisible: (layerId: string) => void;
  setActiveLayer: (layerId: string) => void;
  updateActiveLayerData: (dataUrl: string, snapshotPrev?: string) => void;
  /** Replace a specific layer's pixels (used for transforms) */
  updateLayerData: (frameIdx: number, layerId: string, dataUrl: string, snapshotPrev?: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  play: () => void;
  pause: () => void;

  newProject: (w?: number, h?: number) => void;
  loadProject: (p: Project) => void;

  loadFromLocalStorage: () => void;
  saveToLocalStorage: () => void;
}

const pushHistory = (
  history: Record<string, string[]>,
  layerId: string,
  snapshot: string,
) => {
  const next = { ...history };
  next[layerId] = [...(next[layerId] || []), snapshot].slice(-50);
  return next;
};

export const useStore = create<AppState>((set, get) => ({
  project: defaultProject(),
  currentFrame: 0,
  tool: { tool: "pencil", color: "#1f2937", size: 6, opacity: 1, mirrorAxis: "horizontal", shapeFill: false },
  onion: { enabled: true },
  isPlaying: false,
  history: {},
  future: {},

  setTool: (patch) => set((s) => ({ tool: { ...s.tool, ...patch } })),
  setOnion: (patch) => set((s) => ({ onion: { ...s.onion, ...patch } })),
  setProjectMeta: (patch) =>
    set((s) => ({ project: { ...s.project, ...patch, updatedAt: Date.now() } })),

  setCurrentFrame: (i) =>
    set((s) => ({ currentFrame: Math.max(0, Math.min(s.project.frames.length - 1, i)) })),

  addFrame: () =>
    set((s) => {
      const blank = makeFrame(s.project.width, s.project.height);
      const frames = [...s.project.frames];
      frames.splice(s.currentFrame + 1, 0, blank);
      return {
        project: { ...s.project, frames, updatedAt: Date.now() },
        currentFrame: s.currentFrame + 1,
      };
    }),

  duplicateFrame: (i) =>
    set((s) => {
      const idx = i ?? s.currentFrame;
      const src = s.project.frames[idx];
      if (!src) return {};
      const dup: Frame = {
        ...src,
        id: uid(),
        layers: src.layers.map((l) => ({ ...l, id: uid() })),
      };
      // Re-map active layer id to the duplicated equivalent
      const srcActiveIdx = src.layers.findIndex((l) => l.id === src.activeLayerId);
      dup.activeLayerId = dup.layers[Math.max(0, srcActiveIdx)].id;
      const frames = [...s.project.frames];
      frames.splice(idx + 1, 0, dup);
      return {
        project: { ...s.project, frames, updatedAt: Date.now() },
        currentFrame: idx + 1,
      };
    }),

  deleteFrame: (i) =>
    set((s) => {
      if (s.project.frames.length <= 1) return {};
      const idx = i ?? s.currentFrame;
      const frames = s.project.frames.filter((_, k) => k !== idx);
      return {
        project: { ...s.project, frames, updatedAt: Date.now() },
        currentFrame: Math.max(0, Math.min(idx, frames.length - 1)),
      };
    }),

  moveFrame: (from, to) =>
    set((s) => {
      const frames = [...s.project.frames];
      if (from < 0 || from >= frames.length || to < 0 || to >= frames.length) return {};
      const [m] = frames.splice(from, 1);
      frames.splice(to, 0, m);
      let cur = s.currentFrame;
      if (cur === from) cur = to;
      else if (from < cur && to >= cur) cur--;
      else if (from > cur && to <= cur) cur++;
      return { project: { ...s.project, frames, updatedAt: Date.now() }, currentFrame: cur };
    }),

  setFrameHold: (i, hold) =>
    set((s) => ({
      project: {
        ...s.project,
        frames: s.project.frames.map((f, k) => (k === i ? { ...f, hold: Math.max(1, hold) } : f)),
        updatedAt: Date.now(),
      },
    })),

  addLayer: () =>
    set((s) => {
      const f = s.project.frames[s.currentFrame];
      if (!f) return {};
      const idx = f.layers.findIndex((l) => l.id === f.activeLayerId);
      const newLayer = makeLayer(`Layer ${f.layers.length + 1}`, s.project.width, s.project.height);
      const layers = [...f.layers];
      layers.splice(Math.max(0, idx + 1), 0, newLayer);
      const frames = s.project.frames.map((fr, k) =>
        k === s.currentFrame ? { ...fr, layers, activeLayerId: newLayer.id } : fr,
      );
      return { project: { ...s.project, frames, updatedAt: Date.now() } };
    }),

  duplicateLayer: (layerId) =>
    set((s) => {
      const f = s.project.frames[s.currentFrame];
      if (!f) return {};
      const id = layerId ?? f.activeLayerId;
      const idx = f.layers.findIndex((l) => l.id === id);
      if (idx < 0) return {};
      const src = f.layers[idx];
      const dup: Layer = { ...src, id: uid(), name: `${src.name} copy` };
      const layers = [...f.layers];
      layers.splice(idx + 1, 0, dup);
      const frames = s.project.frames.map((fr, k) =>
        k === s.currentFrame ? { ...fr, layers, activeLayerId: dup.id } : fr,
      );
      return { project: { ...s.project, frames, updatedAt: Date.now() } };
    }),

  deleteLayer: (layerId) =>
    set((s) => {
      const f = s.project.frames[s.currentFrame];
      if (!f || f.layers.length <= 1) return {};
      const id = layerId ?? f.activeLayerId;
      const idx = f.layers.findIndex((l) => l.id === id);
      if (idx < 0) return {};
      const layers = f.layers.filter((l) => l.id !== id);
      const newActive = layers[Math.min(idx, layers.length - 1)].id;
      const frames = s.project.frames.map((fr, k) =>
        k === s.currentFrame ? { ...fr, layers, activeLayerId: newActive } : fr,
      );
      return { project: { ...s.project, frames, updatedAt: Date.now() } };
    }),

  moveLayer: (from, to) =>
    set((s) => {
      const f = s.project.frames[s.currentFrame];
      if (!f) return {};
      const layers = [...f.layers];
      if (from < 0 || from >= layers.length || to < 0 || to >= layers.length) return {};
      const [m] = layers.splice(from, 1);
      layers.splice(to, 0, m);
      const frames = s.project.frames.map((fr, k) =>
        k === s.currentFrame ? { ...fr, layers } : fr,
      );
      return { project: { ...s.project, frames, updatedAt: Date.now() } };
    }),

  renameLayer: (layerId, name) =>
    set((s) => {
      const frames = s.project.frames.map((fr, k) =>
        k === s.currentFrame
          ? { ...fr, layers: fr.layers.map((l) => (l.id === layerId ? { ...l, name } : l)) }
          : fr,
      );
      return { project: { ...s.project, frames, updatedAt: Date.now() } };
    }),

  toggleLayerVisible: (layerId) =>
    set((s) => {
      const frames = s.project.frames.map((fr, k) =>
        k === s.currentFrame
          ? { ...fr, layers: fr.layers.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)) }
          : fr,
      );
      return { project: { ...s.project, frames, updatedAt: Date.now() } };
    }),

  setActiveLayer: (layerId) =>
    set((s) => {
      const frames = s.project.frames.map((fr, k) =>
        k === s.currentFrame ? { ...fr, activeLayerId: layerId } : fr,
      );
      return { project: { ...s.project, frames } };
    }),

  updateActiveLayerData: (dataUrl, snapshotPrev) =>
    set((s) => {
      const f = s.project.frames[s.currentFrame];
      if (!f) return {};
      const id = f.activeLayerId;
      let history = s.history;
      if (snapshotPrev !== undefined) history = pushHistory(history, id, snapshotPrev);
      const future = { ...s.future, [id]: [] };
      const layers = f.layers.map((l) => (l.id === id ? { ...l, dataUrl } : l));
      const frames = s.project.frames.map((fr, k) =>
        k === s.currentFrame ? { ...fr, layers } : fr,
      );
      return { project: { ...s.project, frames, updatedAt: Date.now() }, history, future };
    }),

  updateLayerData: (frameIdx, layerId, dataUrl, snapshotPrev) =>
    set((s) => {
      let history = s.history;
      if (snapshotPrev !== undefined) history = pushHistory(history, layerId, snapshotPrev);
      const future = { ...s.future, [layerId]: [] };
      const frames = s.project.frames.map((fr, k) =>
        k === frameIdx
          ? { ...fr, layers: fr.layers.map((l) => (l.id === layerId ? { ...l, dataUrl } : l)) }
          : fr,
      );
      return { project: { ...s.project, frames, updatedAt: Date.now() }, history, future };
    }),

  undo: () =>
    set((s) => {
      const f = s.project.frames[s.currentFrame];
      if (!f) return {};
      const id = f.activeLayerId;
      const stack = s.history[id] || [];
      if (!stack.length) return {};
      const prev = stack[stack.length - 1];
      const newStack = stack.slice(0, -1);
      const layer = f.layers.find((l) => l.id === id);
      const fut = [...(s.future[id] || []), layer?.dataUrl ?? ""].slice(-50);
      const frames = s.project.frames.map((fr, k) =>
        k === s.currentFrame
          ? { ...fr, layers: fr.layers.map((l) => (l.id === id ? { ...l, dataUrl: prev } : l)) }
          : fr,
      );
      return {
        project: { ...s.project, frames, updatedAt: Date.now() },
        history: { ...s.history, [id]: newStack },
        future: { ...s.future, [id]: fut },
      };
    }),

  redo: () =>
    set((s) => {
      const f = s.project.frames[s.currentFrame];
      if (!f) return {};
      const id = f.activeLayerId;
      const stack = s.future[id] || [];
      if (!stack.length) return {};
      const next = stack[stack.length - 1];
      const newStack = stack.slice(0, -1);
      const layer = f.layers.find((l) => l.id === id);
      const hist = [...(s.history[id] || []), layer?.dataUrl ?? ""].slice(-50);
      const frames = s.project.frames.map((fr, k) =>
        k === s.currentFrame
          ? { ...fr, layers: fr.layers.map((l) => (l.id === id ? { ...l, dataUrl: next } : l)) }
          : fr,
      );
      return {
        project: { ...s.project, frames, updatedAt: Date.now() },
        future: { ...s.future, [id]: newStack },
        history: { ...s.history, [id]: hist },
      };
    }),

  canUndo: () => {
    const s = get();
    const f = s.project.frames[s.currentFrame];
    return !!f && (s.history[f.activeLayerId]?.length ?? 0) > 0;
  },
  canRedo: () => {
    const s = get();
    const f = s.project.frames[s.currentFrame];
    return !!f && (s.future[f.activeLayerId]?.length ?? 0) > 0;
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),

  newProject: (w = 800, h = 600) =>
    set(() => {
      const p = defaultProject();
      p.width = w;
      p.height = h;
      p.frames = [makeFrame(w, h)];
      return { project: p, currentFrame: 0, history: {}, future: {}, isPlaying: false };
    }),

  loadProject: (p) =>
    set({ project: p, currentFrame: 0, history: {}, future: {}, isPlaying: false }),

  loadFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Project;
      if (p && p.frames && p.frames.length && p.frames[0].layers) {
        set({ project: p, currentFrame: 0, history: {}, future: {} });
      }
    } catch {
      /* ignore */
    }
  },

  saveToLocalStorage: () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(get().project));
    } catch {
      /* quota */
    }
  },
}));
