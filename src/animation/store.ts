import { create } from "zustand";
import { Frame, OnionSettings, Project, ToolSettings } from "./types";
import { createBlankDataUrl, uid } from "./utils";

const STORAGE_KEY = "kodflip:project:v1";

const makeFrame = (width: number, height: number, bg: string): Frame => ({
  id: uid(),
  dataUrl: createBlankDataUrl(width, height, bg),
  hold: 1,
});

const defaultProject = (): Project => {
  const w = 800, h = 600;
  return {
    id: uid(),
    name: "My Animation",
    width: w,
    height: h,
    bgColor: "#ffffff",
    fps: 12,
    loop: true,
    frames: [makeFrame(w, h, "#ffffff")],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

interface AppState {
  project: Project;
  currentFrame: number;
  tool: ToolSettings;
  onion: OnionSettings;
  isPlaying: boolean;
  // Branch undo/redo per-frame (last data url snapshots before edit)
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
  updateFrameData: (i: number, dataUrl: string, snapshotPrev?: string) => void;
  setFrameHold: (i: number, hold: number) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // playback
  play: () => void;
  pause: () => void;

  // project lifecycle
  newProject: (w?: number, h?: number) => void;
  loadProject: (p: Project) => void;

  // persistence
  loadFromLocalStorage: () => void;
  saveToLocalStorage: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  project: defaultProject(),
  currentFrame: 0,
  tool: {
    tool: "brush",
    color: "#1f2937",
    size: 6,
    opacity: 1,
    mirror: false,
    pressure: true,
  },
  onion: { enabled: true, prev: 1, next: 1, opacity: 0.3 },
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
      const blank = makeFrame(s.project.width, s.project.height, s.project.bgColor);
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
      const dup: Frame = { ...src, id: uid() };
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

  updateFrameData: (i, dataUrl, snapshotPrev) =>
    set((s) => {
      const frame = s.project.frames[i];
      if (!frame) return {};
      const history = { ...s.history };
      if (snapshotPrev !== undefined) {
        history[frame.id] = [...(history[frame.id] || []), snapshotPrev].slice(-50);
      }
      const future = { ...s.future, [frame.id]: [] };
      const frames = s.project.frames.map((f, k) => (k === i ? { ...f, dataUrl } : f));
      return {
        project: { ...s.project, frames, updatedAt: Date.now() },
        history,
        future,
      };
    }),

  setFrameHold: (i, hold) =>
    set((s) => ({
      project: {
        ...s.project,
        frames: s.project.frames.map((f, k) => (k === i ? { ...f, hold: Math.max(1, hold) } : f)),
        updatedAt: Date.now(),
      },
    })),

  undo: () =>
    set((s) => {
      const frame = s.project.frames[s.currentFrame];
      if (!frame) return {};
      const stack = s.history[frame.id] || [];
      if (!stack.length) return {};
      const prev = stack[stack.length - 1];
      const newStack = stack.slice(0, -1);
      const fut = [...(s.future[frame.id] || []), frame.dataUrl].slice(-50);
      const frames = s.project.frames.map((f, k) =>
        k === s.currentFrame ? { ...f, dataUrl: prev } : f,
      );
      return {
        project: { ...s.project, frames, updatedAt: Date.now() },
        history: { ...s.history, [frame.id]: newStack },
        future: { ...s.future, [frame.id]: fut },
      };
    }),

  redo: () =>
    set((s) => {
      const frame = s.project.frames[s.currentFrame];
      if (!frame) return {};
      const stack = s.future[frame.id] || [];
      if (!stack.length) return {};
      const next = stack[stack.length - 1];
      const newStack = stack.slice(0, -1);
      const hist = [...(s.history[frame.id] || []), frame.dataUrl].slice(-50);
      const frames = s.project.frames.map((f, k) =>
        k === s.currentFrame ? { ...f, dataUrl: next } : f,
      );
      return {
        project: { ...s.project, frames, updatedAt: Date.now() },
        future: { ...s.future, [frame.id]: newStack },
        history: { ...s.history, [frame.id]: hist },
      };
    }),

  canUndo: () => {
    const s = get();
    const f = s.project.frames[s.currentFrame];
    return !!f && (s.history[f.id]?.length ?? 0) > 0;
  },
  canRedo: () => {
    const s = get();
    const f = s.project.frames[s.currentFrame];
    return !!f && (s.future[f.id]?.length ?? 0) > 0;
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),

  newProject: (w = 800, h = 600) =>
    set(() => {
      const p = defaultProject();
      p.width = w;
      p.height = h;
      p.frames = [makeFrame(w, h, p.bgColor)];
      return { project: p, currentFrame: 0, history: {}, future: {}, isPlaying: false };
    }),

  loadProject: (p) =>
    set({ project: p, currentFrame: 0, history: {}, future: {}, isPlaying: false }),

  loadFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as Project;
      if (p && p.frames && p.frames.length) {
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
