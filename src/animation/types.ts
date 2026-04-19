export type ToolId =
  | "brush"
  | "pencil"
  | "eraser"
  | "fill"
  | "line"
  | "rect"
  | "ellipse"
  | "eyedropper"
  | "pan";

export interface Frame {
  id: string;
  /** PNG data URL of the frame at canvas resolution */
  dataUrl: string;
  /** Per-frame hold (in playback frames at project FPS). 1 = single tick. */
  hold: number;
}

export interface ToolSettings {
  tool: ToolId;
  color: string;
  size: number;
  opacity: number; // 0..1
  mirror: boolean;
  pressure: boolean;
}

export interface OnionSettings {
  enabled: boolean;
  prev: number; // # of previous frames shown
  next: number; // # of next frames shown
  opacity: number; // 0..1
}

export interface Project {
  id: string;
  name: string;
  width: number;
  height: number;
  bgColor: string; // canvas background (hex, or "transparent")
  fps: number;
  loop: boolean;
  frames: Frame[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_PALETTE = [
  "#000000", "#ffffff", "#ef4f6b", "#ff8a3d", "#ffd23f", "#7ed957",
  "#3da9fc", "#7b5cff", "#ff6fb5", "#8b5a2b", "#9aa0a6", "#1f2937",
];
