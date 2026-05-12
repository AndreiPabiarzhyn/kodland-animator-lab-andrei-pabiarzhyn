import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { Plus, Minus as MinusIcon, Maximize2 } from "lucide-react";
import { useStore } from "@/animation/store";
import { ONION_OPACITY, ONION_TINT } from "@/animation/types";
import { floodFill, hexToRgba, hexToRgbArr, loadImage, rgbToHex, clamp } from "@/animation/utils";

interface Props { className?: string }

type Selection = {
  sx: number; sy: number; sw: number; sh: number;
  cx: number; cy: number;
  w: number; h: number;
  rot: number;
  imageData: ImageData;
  baseSnapshot: string;
};

type DragMode =
  | { kind: "none" }
  | { kind: "marquee"; x0: number; y0: number }
  | { kind: "move"; ox: number; oy: number; cx0: number; cy0: number }
  | { kind: "resize"; handle: string; ox: number; oy: number; w0: number; h0: number; cx0: number; cy0: number }
  | { kind: "rotate"; ox: number; oy: number; rot0: number; cx: number; cy: number }
  | { kind: "shape"; shape: "rectangle" | "circle" | "line"; x0: number; y0: number };

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;
const MIN_VISIBLE = 80; // keep at least this many px of canvas inside viewport

export const DrawingCanvas = ({ className }: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const belowRef = useRef<HTMLCanvasElement>(null);   // layers strictly below active
  const aboveRef = useRef<HTMLCanvasElement>(null);   // layers strictly above active
  const liveRef = useRef<HTMLCanvasElement>(null);    // active layer + live stroke + overlays
  const onionRef = useRef<HTMLCanvasElement>(null);   // onion skin

  const project = useStore((s) => s.project);
  const currentFrame = useStore((s) => s.currentFrame);
  const tool = useStore((s) => s.tool);
  const onion = useStore((s) => s.onion);
  const setTool = useStore((s) => s.setTool);
  const updateActiveLayerData = useStore((s) => s.updateActiveLayerData);

  const frame = project.frames[currentFrame];
  const activeLayer = frame?.layers.find((l) => l.id === frame.activeLayerId);

  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [wrapSize, setWrapSize] = useState({ w: 0, h: 0 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [panActive, setPanActive] = useState(false);
  const dragRef = useRef<DragMode>({ kind: "none" });
  const selectionRef = useRef<Selection | null>(null);
  useEffect(() => { selectionRef.current = selection; }, [selection]);

  const drawingRef = useRef<{
    active: boolean;
    last: { x: number; y: number; pressure: number } | null;
    startSnapshot: string | null;
    layerId: string | null;
    frameId: string | null;
  }>({ active: false, last: null, startSnapshot: null, layerId: null, frameId: null });

  /** Synchronous offscreen caches of the 3-way layer split for the current frame. */
  const cacheRef = useRef<{
    frameId: string | null;
    activeId: string | null;
    below: HTMLCanvasElement | null;
    active: HTMLCanvasElement | null;
    above: HTMLCanvasElement | null;
  }>({ frameId: null, activeId: null, below: null, active: null, above: null });

  const panRef = useRef<{ active: boolean; startX: number; startY: number; tx0: number; ty0: number }>({
    active: false, startX: 0, startY: 0, tx0: 0, ty0: 0,
  });

  // ----- View bounds clamping -----
  const clampView = useCallback((v: { scale: number; tx: number; ty: number }) => {
    const wrap = wrapRef.current;
    if (!wrap) return v;
    const wW = wrap.clientWidth, wH = wrap.clientHeight;
    const cW = project.width * v.scale;
    const cH = project.height * v.scale;
    // canvas center on screen = (wW/2 + tx, wH/2 + ty)
    // canvas left edge = wW/2 + tx - cW/2; right edge = wW/2 + tx + cW/2
    // require: right edge >= MIN_VISIBLE  AND  left edge <= wW - MIN_VISIBLE
    const minTx = MIN_VISIBLE - wW / 2 - cW / 2;
    const maxTx = wW / 2 + cW / 2 - MIN_VISIBLE;
    const minTy = MIN_VISIBLE - wH / 2 - cH / 2;
    const maxTy = wH / 2 + cH / 2 - MIN_VISIBLE;
    return {
      scale: v.scale,
      tx: clamp(v.tx, minTx, maxTx),
      ty: clamp(v.ty, minTy, maxTy),
    };
  }, [project.width, project.height]);

  // ----- Initial fit & wrap size tracking -----
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      setWrapSize({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Initial center & fit on project size change
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const pad = 32;
    const w = wrap.clientWidth - pad * 2;
    const h = wrap.clientHeight - pad * 2;
    if (w <= 0 || h <= 0) return;
    const scale = Math.min(w / project.width, h / project.height, 1.5);
    setView({ scale, tx: 0, ty: 0 });
  }, [project.width, project.height]);

  // ----- Set canvas pixel sizes on project size change -----
  useEffect(() => {
    for (const r of [belowRef, aboveRef, liveRef, onionRef]) {
      if (r.current) {
        r.current.width = project.width;
        r.current.height = project.height;
      }
    }
  }, [project.width, project.height]);

  // ----- Sync paint helpers -----
  const paintBelow = useCallback(() => {
    const c = cacheRef.current;
    const cv = belowRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (c.below) ctx.drawImage(c.below, 0, 0);
  }, []);
  const paintAbove = useCallback(() => {
    const c = cacheRef.current;
    const cv = aboveRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (c.above) ctx.drawImage(c.above, 0, 0);
  }, []);
  const paintActiveToLive = useCallback(() => {
    const c = cacheRef.current;
    const cv = liveRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (c.active) ctx.drawImage(c.active, 0, 0);
  }, []);

  // ----- Build cache from frame, paint sync where safe -----
  useEffect(() => {
    if (!frame) return;
    let cancelled = false;
    (async () => {
      const W = project.width, H = project.height;
      const below = document.createElement("canvas"); below.width = W; below.height = H;
      const active = document.createElement("canvas"); active.width = W; active.height = H;
      const above = document.createElement("canvas"); above.width = W; above.height = H;
      const bctx = below.getContext("2d")!;
      const actx = active.getContext("2d")!;
      const ovctx = above.getContext("2d")!;
      let foundActive = false;
      for (const layer of frame.layers) {
        if (layer.id === frame.activeLayerId) {
          foundActive = true;
          if (layer.visible) {
            try {
              const img = await loadImage(layer.dataUrl);
              if (cancelled) return;
              actx.drawImage(img, 0, 0);
            } catch { /* ignore */ }
          }
          continue;
        }
        if (!layer.visible) continue;
        try {
          const img = await loadImage(layer.dataUrl);
          if (cancelled) return;
          if (!foundActive) bctx.drawImage(img, 0, 0);
          else ovctx.drawImage(img, 0, 0);
        } catch { /* ignore */ }
      }
      if (cancelled) return;
      // If the user is mid-stroke / mid-transform on the active layer, do
      // NOT replace cacheRef (would lose in-flight pixels). Just refresh
      // the below/above caches that aren't being mutated.
      const busy =
        drawingRef.current.active ||
        dragRef.current.kind === "shape" ||
        dragRef.current.kind === "marquee" ||
        dragRef.current.kind === "move" ||
        dragRef.current.kind === "resize" ||
        dragRef.current.kind === "rotate" ||
        selectionRef.current !== null;
      if (busy && cacheRef.current.frameId === frame.id && cacheRef.current.activeId === frame.activeLayerId) {
        cacheRef.current = {
          ...cacheRef.current,
          below, above,
        };
        paintBelow();
        paintAbove();
        return;
      }
      cacheRef.current = {
        frameId: frame.id,
        activeId: frame.activeLayerId,
        below, active, above,
      };
      paintBelow();
      paintAbove();
      paintActiveToLive();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, project.width, project.height, paintBelow, paintAbove, paintActiveToLive]);

  // ----- Onion skin: previous frame only -----
  useEffect(() => {
    const cv = onionRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!onion.enabled) return;
    const prev = project.frames[currentFrame - 1];
    if (!prev) return;
    let cancelled = false;
    (async () => {
      const tmp = document.createElement("canvas");
      tmp.width = cv.width; tmp.height = cv.height;
      const tctx = tmp.getContext("2d")!;
      for (const layer of prev.layers) {
        if (!layer.visible) continue;
        try {
          const img = await loadImage(layer.dataUrl);
          if (cancelled) return;
          tctx.drawImage(img, 0, 0);
        } catch { /* ignore */ }
      }
      tctx.globalCompositeOperation = "source-atop";
      tctx.fillStyle = ONION_TINT;
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = ONION_OPACITY;
      ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 1;
    })();
    return () => { cancelled = true; };
  }, [onion.enabled, currentFrame, project.frames]);

  // ----- Helpers -----
  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const cv = liveRef.current!;
    const rect = cv.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * cv.width;
    const y = ((clientY - rect.top) / rect.height) * cv.height;
    return { x, y };
  }, []);

  // ----- Selection overlay (draws active baseline + transform handles) -----
  const renderSelectionOverlay = useCallback(() => {
    const live = liveRef.current;
    if (!live) return;
    const ctx = live.getContext("2d")!;
    ctx.clearRect(0, 0, live.width, live.height);
    // Active baseline first so non-selected pixels stay visible
    const c = cacheRef.current;
    if (c.active) ctx.drawImage(c.active, 0, 0);
    if (!selection) return;

    ctx.save();
    ctx.translate(selection.cx, selection.cy);
    ctx.rotate(selection.rot);
    const off = document.createElement("canvas");
    off.width = selection.sw;
    off.height = selection.sh;
    off.getContext("2d")!.putImageData(selection.imageData, 0, 0);
    ctx.drawImage(off, -selection.w / 2, -selection.h / 2, selection.w, selection.h);
    ctx.restore();

    ctx.save();
    ctx.translate(selection.cx, selection.cy);
    ctx.rotate(selection.rot);
    const hx = selection.w / 2;
    const hy = selection.h / 2;
    ctx.lineWidth = 2 / view.scale;
    ctx.setLineDash([6 / view.scale, 4 / view.scale]);
    ctx.strokeStyle = "hsl(195 90% 55%)";
    ctx.strokeRect(-hx, -hy, selection.w, selection.h);
    ctx.setLineDash([]);
    const handleSize = 10 / view.scale;
    const handles: Array<[number, number]> = [
      [-hx, -hy], [0, -hy], [hx, -hy],
      [-hx, 0], [hx, 0],
      [-hx, hy], [0, hy], [hx, hy],
    ];
    ctx.fillStyle = "white";
    ctx.strokeStyle = "hsl(195 90% 45%)";
    for (const [x, y] of handles) {
      ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    }
    ctx.beginPath();
    ctx.moveTo(0, -hy);
    ctx.lineTo(0, -hy - 24 / view.scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -hy - 24 / view.scale, 6 / view.scale, 0, Math.PI * 2);
    ctx.fillStyle = "hsl(195 90% 55%)";
    ctx.fill();
    ctx.restore();
  }, [selection, view.scale]);

  useEffect(() => { renderSelectionOverlay(); }, [renderSelectionOverlay]);

  // ----- Reset on frame/active layer change -----
  const activeLayerId = frame?.activeLayerId ?? null;
  useEffect(() => {
    if (drawingRef.current.active || dragRef.current.kind === "shape") commitLiveStroke();
    setSelection(null);
    dragRef.current = { kind: "none" };
    drawingRef.current.active = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerId, currentFrame]);

  // ----- Selection commit / cancel -----
  const commitSelection = useCallback(async () => {
    if (!selection || !activeLayer) return;
    const layerCv = document.createElement("canvas");
    layerCv.width = project.width;
    layerCv.height = project.height;
    const lctx = layerCv.getContext("2d")!;
    // Use cache.active (already holed at marquee time) as authoritative
    // base — fully in sync with what the user sees, no async race.
    const cache = cacheRef.current;
    if (cache.active && cache.activeId === activeLayer.id) {
      lctx.drawImage(cache.active, 0, 0);
    } else {
      try {
        const img = await loadImage(activeLayer.dataUrl);
        lctx.drawImage(img, 0, 0);
      } catch { /* ignore */ }
    }
    lctx.save();
    lctx.translate(selection.cx, selection.cy);
    lctx.rotate(selection.rot);
    const off = document.createElement("canvas");
    off.width = selection.sw;
    off.height = selection.sh;
    off.getContext("2d")!.putImageData(selection.imageData, 0, 0);
    lctx.drawImage(off, -selection.w / 2, -selection.h / 2, selection.w, selection.h);
    lctx.restore();
    // Sync cache.active + live BEFORE store update so canvas updates instantly.
    if (cache.active && cache.activeId === activeLayer.id) {
      const actx = cache.active.getContext("2d")!;
      actx.clearRect(0, 0, cache.active.width, cache.active.height);
      actx.drawImage(layerCv, 0, 0);
    }
    setSelection(null);
    paintActiveToLive();
    updateActiveLayerData(layerCv.toDataURL("image/png"), selection.baseSnapshot);
  }, [selection, activeLayer, project.width, project.height, updateActiveLayerData, paintActiveToLive]);

  const cancelSelection = useCallback(() => {
    if (!selection) return;
    const cache = cacheRef.current;
    const baseSnap = selection.baseSnapshot;
    if (cache.active && activeLayer && cache.activeId === activeLayer.id) {
      loadImage(baseSnap).then((img) => {
        const actx = cache.active!.getContext("2d")!;
        actx.clearRect(0, 0, cache.active!.width, cache.active!.height);
        actx.drawImage(img, 0, 0);
        paintActiveToLive();
      }).catch(() => { /* ignore */ });
    }
    setSelection(null);
    updateActiveLayerData(baseSnap);
  }, [selection, activeLayer, updateActiveLayerData, paintActiveToLive]);

  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "Escape") { e.preventDefault(); cancelSelection(); }
      if (e.key === "Enter") { e.preventDefault(); commitSelection(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, commitSelection, cancelSelection]);

  const hitTestSelection = (p: { x: number; y: number }): string | null => {
    if (!selection) return null;
    const dx = p.x - selection.cx;
    const dy = p.y - selection.cy;
    const cos = Math.cos(-selection.rot);
    const sin = Math.sin(-selection.rot);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const hx = selection.w / 2;
    const hy = selection.h / 2;
    const tol = 12 / view.scale;
    if (Math.abs(lx) < tol && Math.abs(ly - (-hy - 24 / view.scale)) < tol) return "rotate";
    const handles: Array<[string, number, number]> = [
      ["nw", -hx, -hy], ["n", 0, -hy], ["ne", hx, -hy],
      ["w", -hx, 0], ["e", hx, 0],
      ["sw", -hx, hy], ["s", 0, hy], ["se", hx, hy],
    ];
    for (const [name, x, y] of handles) {
      if (Math.abs(lx - x) < tol && Math.abs(ly - y) < tol) return name;
    }
    if (Math.abs(lx) <= hx && Math.abs(ly) <= hy) return "move";
    return null;
  };

  // ----- Stroke drawing -----
  const drawStrokeSegment = (
    contexts: CanvasRenderingContext2D[],
    a: { x: number; y: number },
    b: { x: number; y: number },
    erase: boolean,
  ) => {
    for (const ctx of contexts) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = tool.size;
      if (erase) {
        // Full alpha erase — opacity slider intentionally ignored so the
        // eraser always cleanly removes pixels (matches user expectation).
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.fillStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = hexToRgba(tool.color, tool.opacity);
        ctx.fillStyle = hexToRgba(tool.color, tool.opacity);
      }
      // For zero-length segments (initial click) draw a round dot so a single
      // tap still erases / paints a visible mark.
      if (a.x === b.x && a.y === b.y) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, Math.max(0.5, tool.size / 2), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const drawMirroredSegment = (
    contexts: CanvasRenderingContext2D[],
    a: { x: number; y: number },
    b: { x: number; y: number },
    erase: boolean,
  ) => {
    const w = project.width;
    const h = project.height;
    const axis = tool.mirrorAxis;
    drawStrokeSegment(contexts, a, b, erase);
    if (axis === "horizontal" || axis === "both") {
      drawStrokeSegment(contexts, { x: w - a.x, y: a.y }, { x: w - b.x, y: b.y }, erase);
    }
    if (axis === "vertical" || axis === "both") {
      drawStrokeSegment(contexts, { x: a.x, y: h - a.y }, { x: b.x, y: h - b.y }, erase);
    }
    if (axis === "both") {
      drawStrokeSegment(contexts, { x: w - a.x, y: h - a.y }, { x: w - b.x, y: h - b.y }, erase);
    }
  };

  const renderShape = (
    ctx: CanvasRenderingContext2D,
    shape: "rectangle" | "circle" | "line",
    x0: number, y0: number, x1: number, y1: number,
  ) => {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = tool.size;
    ctx.strokeStyle = hexToRgba(tool.color, tool.opacity);
    ctx.fillStyle = hexToRgba(tool.color, tool.opacity);
    if (shape === "line") {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    } else if (shape === "rectangle") {
      const x = Math.min(x0, x1), y = Math.min(y0, y1);
      const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      if (tool.shapeFill) ctx.fillRect(x, y, w, h);
      else ctx.strokeRect(x, y, w, h);
    } else {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (tool.shapeFill) ctx.fill();
      else ctx.stroke();
    }
    ctx.restore();
  };

  const beginLiveStroke = () => {
    if (!activeLayer || !frame) return;
    drawingRef.current.startSnapshot = activeLayer.dataUrl;
    drawingRef.current.layerId = activeLayer.id;
    drawingRef.current.frameId = frame.id;
    // live already shows cache.active synchronously; nothing to do.
  };

  /**
   * Returns the contexts that a freehand stroke (pencil/eraser/mirror) should
   * draw into. We always draw into the live canvas (for instant feedback)
   * AND into the cached active-layer offscreen canvas when it matches the
   * current active layer. This guarantees that:
   *   - the live preview never diverges from the cache
   *   - commit reads the authoritative cache.active bitmap
   *   - eraser strokes stay confined to the active layer
   */
  const getStrokeContexts = (): CanvasRenderingContext2D[] => {
    const out: CanvasRenderingContext2D[] = [];
    const live = liveRef.current;
    if (live) out.push(live.getContext("2d")!);
    const c = cacheRef.current;
    if (
      c.active &&
      c.activeId === activeLayer?.id &&
      c.frameId === frame?.id
    ) {
      out.push(c.active.getContext("2d")!);
    }
    return out;
  };

  const commitLiveStroke = useCallback(() => {
    const layerId = drawingRef.current.layerId;
    const frameId = drawingRef.current.frameId;
    const snap = drawingRef.current.startSnapshot ?? undefined;
    if (layerId && frameId) {
      // Prefer the cache (always in-sync source of truth for the active
      // layer). Fall back to the live canvas only if cache is stale.
      const c = cacheRef.current;
      let source: HTMLCanvasElement | null = null;
      if (c.active && c.activeId === layerId) source = c.active;
      else source = liveRef.current;
      if (source) {
        const dataUrl = source.toDataURL("image/png");
        const s = useStore.getState();
        const idx = s.project.frames.findIndex((f) => f.id === frameId);
        if (idx >= 0) s.updateLayerData(idx, layerId, dataUrl, snap);
      }
    }
    drawingRef.current.layerId = null;
    drawingRef.current.frameId = null;
    drawingRef.current.startSnapshot = null;
    drawingRef.current.last = null;
    drawingRef.current.active = false;
    // do NOT clear live — it represents the active layer post-commit.
  }, []);

  // Auto-commit when tool changes mid-stroke
  useEffect(() => {
    if (!drawingRef.current.active && dragRef.current.kind !== "shape") return;
    commitLiveStroke();
  }, [tool.tool, commitLiveStroke]);

  // ----- Pointer events -----
  const onPointerDown = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = liveRef.current!;
    cv.setPointerCapture(e.pointerId);
    const p = getCanvasPoint(e.clientX, e.clientY);

    // Pan: middle mouse, shift+left, or pan tool
    if (e.button === 1 || (e.shiftKey && e.button === 0) || tool.tool === "pan") {
      panRef.current = {
        active: true, startX: e.clientX, startY: e.clientY, tx0: view.tx, ty0: view.ty,
      };
      setPanActive(true);
      return;
    }

    if (!activeLayer || !frame) return;

    if (tool.tool === "select") {
      const hit = hitTestSelection(p);
      if (selection && hit) {
        if (hit === "move") {
          dragRef.current = { kind: "move", ox: p.x, oy: p.y, cx0: selection.cx, cy0: selection.cy };
        } else if (hit === "rotate") {
          dragRef.current = { kind: "rotate", ox: p.x, oy: p.y, rot0: selection.rot, cx: selection.cx, cy: selection.cy };
        } else {
          dragRef.current = {
            kind: "resize", handle: hit,
            ox: p.x, oy: p.y,
            w0: selection.w, h0: selection.h,
            cx0: selection.cx, cy0: selection.cy,
          };
        }
        return;
      }
      if (selection) await commitSelection();
      dragRef.current = { kind: "marquee", x0: p.x, y0: p.y };
      return;
    }

    if (selection) await commitSelection();

    if (tool.tool === "eyedropper") {
      // Sample full composite of all 3 cache layers
      const W = project.width, H = project.height;
      const tmp = document.createElement("canvas");
      tmp.width = W; tmp.height = H;
      const tctx = tmp.getContext("2d")!;
      const c = cacheRef.current;
      if (c.below) tctx.drawImage(c.below, 0, 0);
      if (c.active) tctx.drawImage(c.active, 0, 0);
      if (c.above) tctx.drawImage(c.above, 0, 0);
      const px = clamp(Math.round(p.x), 0, W - 1);
      const py = clamp(Math.round(p.y), 0, H - 1);
      const d = tctx.getImageData(px, py, 1, 1).data;
      if (d[3] > 0) setTool({ color: rgbToHex(d[0], d[1], d[2]) });
      return;
    }

    if (tool.tool === "fill") {
      const layerCv = document.createElement("canvas");
      layerCv.width = project.width;
      layerCv.height = project.height;
      const lctx = layerCv.getContext("2d")!;
      const snapshot = activeLayer.dataUrl;
      try {
        const img = await loadImage(activeLayer.dataUrl);
        lctx.drawImage(img, 0, 0);
      } catch { /* ignore */ }
      const imgData = lctx.getImageData(0, 0, layerCv.width, layerCv.height);
      const [r, g, b] = hexToRgbArr(tool.color);
      floodFill(imgData, Math.round(p.x), Math.round(p.y), [r, g, b, Math.round(tool.opacity * 255)], 64);
      lctx.putImageData(imgData, 0, 0);
      updateActiveLayerData(layerCv.toDataURL("image/png"), snapshot);
      return;
    }

    if (tool.tool === "rectangle" || tool.tool === "circle" || tool.tool === "line") {
      beginLiveStroke();
      dragRef.current = { kind: "shape", shape: tool.tool, x0: p.x, y0: p.y };
      return;
    }

    // Pencil / Eraser / Mirror Pen
    drawingRef.current.active = true;
    drawingRef.current.last = { ...p, pressure: (e as any).pressure || 0.5 };
    beginLiveStroke();
    const ctxs = getStrokeContexts();
    if (tool.tool === "mirror") drawMirroredSegment(ctxs, p, p, false);
    else drawStrokeSegment(ctxs, p, p, tool.tool === "eraser");
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = getCanvasPoint(e.clientX, e.clientY);
    setCursorPos(p);

    if (panRef.current.active) {
      setView((v) => clampView({
        ...v,
        tx: panRef.current.tx0 + (e.clientX - panRef.current.startX),
        ty: panRef.current.ty0 + (e.clientY - panRef.current.startY),
      }));
      return;
    }

    const dr = dragRef.current;
    if (dr.kind === "marquee") {
      const live = liveRef.current!;
      const ctx = live.getContext("2d")!;
      ctx.clearRect(0, 0, live.width, live.height);
      const c = cacheRef.current;
      if (c.active) ctx.drawImage(c.active, 0, 0);
      const x = Math.min(dr.x0, p.x), y = Math.min(dr.y0, p.y);
      const w = Math.abs(p.x - dr.x0), h = Math.abs(p.y - dr.y0);
      ctx.lineWidth = 2 / view.scale;
      ctx.setLineDash([6 / view.scale, 4 / view.scale]);
      ctx.strokeStyle = "hsl(195 90% 55%)";
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      return;
    }
    if (dr.kind === "move" && selection) {
      setSelection({ ...selection, cx: dr.cx0 + (p.x - dr.ox), cy: dr.cy0 + (p.y - dr.oy) });
      return;
    }
    if (dr.kind === "resize" && selection) {
      const dx = p.x - dr.ox;
      const dy = p.y - dr.oy;
      const cos = Math.cos(-selection.rot), sin = Math.sin(-selection.rot);
      const ldx = dx * cos - dy * sin;
      const ldy = dx * sin + dy * cos;
      let nw = dr.w0, nh = dr.h0;
      let cxShift = 0, cyShift = 0;
      const h = dr.handle;
      if (h.includes("e")) { nw = dr.w0 + ldx; cxShift = ldx / 2; }
      if (h.includes("w")) { nw = dr.w0 - ldx; cxShift = ldx / 2; }
      if (h.includes("s")) { nh = dr.h0 + ldy; cyShift = ldy / 2; }
      if (h.includes("n")) { nh = dr.h0 - ldy; cyShift = ldy / 2; }
      const worldShiftX = cxShift * Math.cos(selection.rot) - cyShift * Math.sin(selection.rot);
      const worldShiftY = cxShift * Math.sin(selection.rot) + cyShift * Math.cos(selection.rot);
      setSelection({ ...selection, w: nw, h: nh, cx: dr.cx0 + worldShiftX, cy: dr.cy0 + worldShiftY });
      return;
    }
    if (dr.kind === "rotate" && selection) {
      const a0 = Math.atan2(dr.oy - dr.cy, dr.ox - dr.cx);
      const a1 = Math.atan2(p.y - dr.cy, p.x - dr.cx);
      setSelection({ ...selection, rot: dr.rot0 + (a1 - a0) });
      return;
    }

    if (dr.kind === "shape") {
      const live = liveRef.current!;
      const lctx = live.getContext("2d")!;
      lctx.clearRect(0, 0, live.width, live.height);
      const cache = cacheRef.current;
      if (cache.active) lctx.drawImage(cache.active, 0, 0);
      renderShape(lctx, dr.shape, dr.x0, dr.y0, p.x, p.y);
      return;
    }
    if (!drawingRef.current.active) return;
    const ctxs = getStrokeContexts();
    const last = drawingRef.current.last!;
    if (tool.tool === "pencil" || tool.tool === "eraser") {
      drawStrokeSegment(ctxs, last, p, tool.tool === "eraser");
      drawingRef.current.last = { ...p, pressure: (e as any).pressure || 0.5 };
    } else if (tool.tool === "mirror") {
      drawMirroredSegment(ctxs, last, p, false);
      drawingRef.current.last = { ...p, pressure: (e as any).pressure || 0.5 };
    }
  };

  const onPointerUp = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    try { liveRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (panRef.current.active) {
      panRef.current.active = false;
      setPanActive(false);
      return;
    }

    const dr = dragRef.current;
    dragRef.current = { kind: "none" };

    if (dr.kind === "shape") {
      const p = getCanvasPoint(e.clientX, e.clientY);
      const live = liveRef.current!;
      const lctx = live.getContext("2d")!;
      lctx.clearRect(0, 0, live.width, live.height);
      const cache = cacheRef.current;
      if (cache.active) lctx.drawImage(cache.active, 0, 0);
      renderShape(lctx, dr.shape, dr.x0, dr.y0, p.x, p.y);
      commitLiveStroke();
      return;
    }

    if (dr.kind === "marquee") {
      const p = getCanvasPoint(e.clientX, e.clientY);
      const x = Math.max(0, Math.floor(Math.min(dr.x0, p.x)));
      const y = Math.max(0, Math.floor(Math.min(dr.y0, p.y)));
      const w = Math.floor(Math.abs(p.x - dr.x0));
      const h = Math.floor(Math.abs(p.y - dr.y0));
      // Reset live to active baseline
      paintActiveToLive();
      if (w < 4 || h < 4 || !activeLayer) return;
      const layerCv = document.createElement("canvas");
      layerCv.width = project.width;
      layerCv.height = project.height;
      const lctx = layerCv.getContext("2d")!;
      try {
        const img = await loadImage(activeLayer.dataUrl);
        lctx.drawImage(img, 0, 0);
      } catch { /* ignore */ }
      const cw = Math.min(w, project.width - x);
      const ch = Math.min(h, project.height - y);
      const imageData = lctx.getImageData(x, y, cw, ch);
      const baseSnapshot = activeLayer.dataUrl;
      lctx.clearRect(x, y, cw, ch);
      updateActiveLayerData(layerCv.toDataURL("image/png"), baseSnapshot);
      setSelection({
        sx: x, sy: y, sw: cw, sh: ch,
        cx: x + cw / 2, cy: y + ch / 2,
        w: cw, h: ch, rot: 0,
        imageData, baseSnapshot,
      });
      return;
    }
    if (dr.kind !== "none") return;

    if (!drawingRef.current.active) return;
    drawingRef.current.active = false;
    commitLiveStroke();
  };

  // ----- Wheel zoom (cursor-centered) -----
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wrect = wrap.getBoundingClientRect();
    const mx = e.clientX - (wrect.left + wrect.width / 2);
    const my = e.clientY - (wrect.top + wrect.height / 2);
    const factor = Math.exp(-e.deltaY * 0.0015);
    setView((v) => {
      const newScale = clamp(v.scale * factor, MIN_ZOOM, MAX_ZOOM);
      const realFactor = newScale / v.scale;
      const newTx = mx - (mx - v.tx) * realFactor;
      const newTy = my - (my - v.ty) * realFactor;
      return clampView({ scale: newScale, tx: newTx, ty: newTy });
    });
  };

  // ----- Zoom buttons -----
  const zoomAtCenter = (factor: number) => {
    setView((v) => {
      const newScale = clamp(v.scale * factor, MIN_ZOOM, MAX_ZOOM);
      const realFactor = newScale / v.scale;
      return clampView({ scale: newScale, tx: v.tx * realFactor, ty: v.ty * realFactor });
    });
  };
  const centerView = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const pad = 32;
    const w = wrap.clientWidth - pad * 2;
    const h = wrap.clientHeight - pad * 2;
    if (w <= 0 || h <= 0) return;
    const scale = Math.min(w / project.width, h / project.height, 1.5);
    setView({ scale, tx: 0, ty: 0 });
  };

  // ----- Scrollbar geometry -----
  const cssW = project.width * view.scale;
  const cssH = project.height * view.scale;
  const wW = wrapSize.w, wH = wrapSize.h;
  // Canvas left/right edges in viewport coords
  const canvasLeft = wW / 2 + view.tx - cssW / 2;
  const canvasTop = wH / 2 + view.ty - cssH / 2;
  const showH = cssW > wW && wW > 0;
  const showV = cssH > wH && wH > 0;
  // Map to "scroll" positions (0 .. overflow)
  const overflowX = Math.max(0, cssW - wW);
  const overflowY = Math.max(0, cssH - wH);
  const scrollX = clamp(-canvasLeft, 0, overflowX);
  const scrollY = clamp(-canvasTop, 0, overflowY);
  // Track widths leave room for the opposite scrollbar
  const trackW = Math.max(0, wW - (showV ? 14 : 0));
  const trackH = Math.max(0, wH - (showH ? 14 : 0));
  const thumbW = showH && cssW > 0 ? Math.max(28, (wW / cssW) * trackW) : 0;
  const thumbH = showV && cssH > 0 ? Math.max(28, (wH / cssH) * trackH) : 0;
  const thumbX = overflowX > 0 ? (scrollX / overflowX) * (trackW - thumbW) : 0;
  const thumbY = overflowY > 0 ? (scrollY / overflowY) * (trackH - thumbH) : 0;

  const startScrollDrag = (orient: "h" | "v") => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const startClient = orient === "h" ? e.clientX : e.clientY;
    const startScroll = orient === "h" ? scrollX : scrollY;
    const overflow = orient === "h" ? overflowX : overflowY;
    const track = orient === "h" ? trackW : trackH;
    const thumb = orient === "h" ? thumbW : thumbH;
    if (track - thumb <= 0 || overflow <= 0) return;
    const onMove = (ev: PointerEvent) => {
      const delta = (orient === "h" ? ev.clientX : ev.clientY) - startClient;
      const newScroll = clamp(startScroll + (delta / (track - thumb)) * overflow, 0, overflow);
      setView((v) => {
        if (orient === "h") {
          // scrollX = -canvasLeft = -(wW/2 + tx - cssW/2) -> tx = cssW/2 - wW/2 - scrollX
          return clampView({ ...v, tx: cssW / 2 - wW / 2 - newScroll });
        } else {
          return clampView({ ...v, ty: cssH / 2 - wH / 2 - newScroll });
        }
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ----- Cursor -----
  const cursorCss = tool.size * view.scale;
  const showRing =
    cursorPos !== null &&
    (tool.tool === "pencil" || tool.tool === "eraser" || tool.tool === "mirror");

  const cursorStyle =
    tool.tool === "pan"
      ? (panActive ? "grabbing" : "grab")
      : tool.tool === "select" ? "default"
      : tool.tool === "eyedropper" ? "crosshair"
      : tool.tool === "fill" ? "cell"
      : tool.tool === "rectangle" || tool.tool === "circle" || tool.tool === "line" ? "crosshair"
      : "none";

  return (
    <div
      ref={wrapRef}
      className={"relative overflow-hidden bg-canvas " + (className ?? "")}
      onWheel={onWheel}
      onPointerLeave={() => setCursorPos(null)}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: cssW,
          height: cssH,
          transform: `translate(calc(-50% + ${view.tx}px), calc(-50% + ${view.ty}px))`,
        }}
      >
        <div className="absolute inset-0 rounded-lg shadow-soft checkerboard" aria-hidden />
        <canvas
          ref={onionRef}
          className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
        />
        <canvas
          ref={belowRef}
          className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
        />
        <canvas
          ref={liveRef}
          width={project.width}
          height={project.height}
          className="absolute inset-0 w-full h-full rounded-lg touch-none"
          style={{ cursor: cursorStyle }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
        <canvas
          ref={aboveRef}
          className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
        />
        {showRing && cursorPos && (
          <div
            className="absolute pointer-events-none rounded-full border-2 border-foreground/80 mix-blend-difference"
            style={{
              width: Math.max(4, cursorCss),
              height: Math.max(4, cursorCss),
              left: cursorPos.x * view.scale - Math.max(4, cursorCss) / 2,
              top: cursorPos.y * view.scale - Math.max(4, cursorCss) / 2,
            }}
            aria-hidden
          />
        )}
      </div>

      {/* Zoom % indicator */}
      <div className="absolute bottom-4 left-2 text-[11px] font-semibold bg-background/70 backdrop-blur px-2 py-1 rounded-lg text-muted-foreground tabular-nums pointer-events-none">
        {Math.round(view.scale * 100)}%
      </div>

      {/* Zoom + Center buttons */}
      <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
        <button
          type="button"
          onClick={() => zoomAtCenter(1.2)}
          aria-label="Zoom in"
          className="h-8 w-8 rounded-lg bg-background/85 hover:bg-background shadow-tool border border-border flex items-center justify-center text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomAtCenter(1 / 1.2)}
          aria-label="Zoom out"
          className="h-8 w-8 rounded-lg bg-background/85 hover:bg-background shadow-tool border border-border flex items-center justify-center text-foreground transition-colors"
        >
          <MinusIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={centerView}
          aria-label="Center & fit"
          title="Center & fit"
          className="h-8 w-8 rounded-lg bg-background/85 hover:bg-background shadow-tool border border-border flex items-center justify-center text-foreground transition-colors"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Horizontal scrollbar */}
      {showH && (
        <div
          className="absolute left-0 bottom-0 h-2.5 bg-muted/40"
          style={{ width: trackW }}
        >
          <div
            role="scrollbar"
            aria-orientation="horizontal"
            onPointerDown={startScrollDrag("h")}
            className="absolute top-0 h-full rounded-full bg-foreground/30 hover:bg-foreground/50 transition-colors cursor-grab active:cursor-grabbing"
            style={{ width: thumbW, left: thumbX }}
          />
        </div>
      )}
      {/* Vertical scrollbar */}
      {showV && (
        <div
          className="absolute right-0 top-0 w-2.5 bg-muted/40"
          style={{ height: trackH }}
        >
          <div
            role="scrollbar"
            aria-orientation="vertical"
            onPointerDown={startScrollDrag("v")}
            className="absolute left-0 w-full rounded-full bg-foreground/30 hover:bg-foreground/50 transition-colors cursor-grab active:cursor-grabbing"
            style={{ height: thumbH, top: thumbY }}
          />
        </div>
      )}

      {selection && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-2">
          <button
            onClick={commitSelection}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-pop"
          >
            Apply (Enter)
          </button>
          <button
            onClick={cancelSelection}
            className="px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold"
          >
            Cancel (Esc)
          </button>
        </div>
      )}
    </div>
  );
};