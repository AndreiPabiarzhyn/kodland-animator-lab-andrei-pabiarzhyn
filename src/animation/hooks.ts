import { useEffect } from "react";
import { useStore } from "@/animation/store";

const TOOL_KEYS: Record<string, string> = {
  p: "pencil",
  e: "eraser",
  g: "fill",
  s: "select",
  i: "eyedropper",
  m: "mirror",
  r: "rectangle",
  c: "circle",
  l: "line",
  h: "pan",
};

export const useShortcuts = () => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const k = e.key.toLowerCase();
      const meta = e.ctrlKey || e.metaKey;
      const s = useStore.getState();

      if (meta && k === "z" && !e.shiftKey) { e.preventDefault(); s.undo(); return; }
      if ((meta && k === "y") || (meta && e.shiftKey && k === "z")) { e.preventDefault(); s.redo(); return; }
      if (k === " ") { e.preventDefault(); s.isPlaying ? s.pause() : s.play(); return; }
      if (k === "arrowright") { e.preventDefault(); s.setCurrentFrame(s.currentFrame + 1); return; }
      if (k === "arrowleft") { e.preventDefault(); s.setCurrentFrame(s.currentFrame - 1); return; }
      if (k === "n" && !meta) { e.preventDefault(); s.addFrame(); return; }
      if (k === "d" && !meta) { e.preventDefault(); s.duplicateFrame(); return; }
      if (k === "[") { e.preventDefault(); s.setTool({ size: Math.max(1, s.tool.size - 1) }); return; }
      if (k === "]") { e.preventDefault(); s.setTool({ size: Math.min(120, s.tool.size + 1) }); return; }

      if (TOOL_KEYS[k] && !meta) {
        e.preventDefault();
        s.setTool({ tool: TOOL_KEYS[k] as never });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
};

export const useAutosave = () => {
  const project = useStore((s) => s.project);
  useEffect(() => {
    const t = setTimeout(() => useStore.getState().saveToLocalStorage(), 800);
    return () => clearTimeout(t);
  }, [project]);

  useEffect(() => {
    useStore.getState().loadFromLocalStorage();
  }, []);
};

export const useTheme = () => {
  useEffect(() => {
    const stored = localStorage.getItem("kodflip:theme");
    if (stored === "dark") document.documentElement.classList.add("dark");
  }, []);
};

export const toggleTheme = () => {
  const root = document.documentElement;
  const isDark = root.classList.toggle("dark");
  localStorage.setItem("kodflip:theme", isDark ? "dark" : "light");
};
