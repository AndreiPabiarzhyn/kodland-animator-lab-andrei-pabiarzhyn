export type ToolId =
  | "pencil"
  | "eraser"
  | "fill"
  | "select"
  | "lasso"
  | "eyedropper"
  | "mirror"
  | "rectangle"
  | "circle"
  | "line"
  | "pan";

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  /** PNG data URL of this layer at canvas resolution */
  dataUrl: string;
}

export interface Frame {
  id: string;
  layers: Layer[];
  activeLayerId: string;
  /** Per-frame hold (in playback frames at project FPS). 1 = single tick. */
  hold: number;
}

export interface ToolSettings {
  tool: ToolId;
  color: string;
  size: number;
  opacity: number; // 0..1
  mirrorAxis: "horizontal" | "vertical" | "both";
  shapeFill: boolean;
}

export interface OnionSettings {
  enabled: boolean;
}

export interface Project {
  id: string;
  /** Incremented for every persisted project change. */
  revision: number;
  name: string;
  width: number;
  height: number;
  /** Always "transparent" in this version, kept for future. */
  bgColor: string;
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

export const BRUSH_PRESETS = [2, 6, 12, 24, 48, 80];

export const ONION_OPACITY = 0.35;
export const ONION_TINT = "#ef4f6b";
