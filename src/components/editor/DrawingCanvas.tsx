import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { useStore } from "@/animation/store";
import { ONION_OPACITY, ONION_TINT } from "@/animation/types";
import { floodFill, hexToRgba, hexToRgbArr, loadImage, rgbToHex, clamp } from "@/animation/utils";

interface Props { className?: string }

type Selection = {
  // origin (pre-transform) source rect on the active layer
  sx: number; sy: number; sw: number; sh: number;
  // current transform
  cx: number; cy: number;       // center
  w: number; h: number;          // current width/height (can be negative when flipped)
  rot: number;                   // radians
  imageData: ImageData;          // captured pixels
  baseSnapshot: string;          // for undo
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

export const DrawingCanvas = ({ className }: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);   // composited frame (all visible layers)
  const liveRef = useRef<HTMLCanvasElement>(null);   // active stroke / shapes / selection overlay
  const onionRef = useRef<HTMLCanvasElement>(null);  // onion skin (previous frame only)

  const project = useStore((s) => s.project);
  const currentFrame = useStore((s) => s.currentFrame);
  const tool = useStore((s) => s.tool);
  const onion = useStore((s) => s.onion);
  const setTool = useStore((s) => s.setTool);
  const updateActiveLayerData = useStore((s) => s.updateActiveLayerData);

  const frame = project.frames[currentFrame];
  const activeLayer = frame?.layers.find((l) => l.id === frame.activeLayerId);

  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const dragRef = useRef<DragMode>({ kind: "none" });

  const drawingRef = useRef<{
    active: boolean;
    last: { x: number; y: number; pressure: number } | null;
    startSnapshot: string | null;
    layerId: string | null;
    frameId: string | null;
  }>({ active: false, last: null, startSnapshot: null, layerId: null, frameId: null });
  /** When drawing, base canvas excludes this layer id so live canvas owns it */
  const drawingLayerIdRef = useRef<string | null>(null);
  const panRef = useRef<{ active: boolean; startX: number; startY: number; tx0: number; ty0: number }>({
    active: false, startX: 0, startY: 0, tx0: 0, ty0: 0,
  });

  // Fit canvas to container
  useLayoutEffect(() => {
    const fit = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const pad = 32;
      const w = wrap.clientWidth - pad * 2;
      const h = wrap.clientHeight - pad * 2;
      if (w <= 0 || h <= 0) return;
      const scale = Math.min(w / project.width, h / project.height, 1.5);
      setView({ scale, tx: 0, ty: 0 });
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [project.width, project.height]);

  // Composite all visible layers into baseRef whenever frame/layers change.
  // While drawing on the active layer we exclude it (live canvas shows it).
  useEffect(() => {
    const cv = baseRef.current;
    if (!cv || !frame) return;
    cv.width = project.width;
    cv.height = project.height;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    let cancelled = false;
    (async () => {
      for (const layer of frame.layers) {
        if (!layer.visible) continue;
        if (drawingLayerIdRef.current === layer.id) continue;
        try {
          const img = await loadImage(layer.dataUrl);
          if (cancelled) return;
          ctx.drawImage(img, 0, 0);
        } catch { /* ignore */ }
      }
    })();
    if (liveRef.current) {
      liveRef.current.width = project.width;
      liveRef.current.height = project.height;
    }
    if (onionRef.current) {
      onionRef.current.width = project.width;
      onionRef.current.height = project.height;
    }
    return () => { cancelled = true; };
  }, [frame, project.width, project.height]);

  // Onion: previous frame only (composited), tinted, fixed opacity
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
      // composite prev frame to a temp canvas first
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
      // tint
      tctx.globalCompositeOperation = "source-atop";
      tctx.fillStyle = ONION_TINT;
      tctx.fillRect(0, 0, tmp.width, tmp.height);
      // draw onto onion canvas with fixed opacity
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.globalAlpha = ONION_OPACITY;
      ctx.drawImage(tmp, 0, 0);
      ctx.globalAlpha = 1;
    })();
    return () => { cancelled = true; };
  }, [onion.enabled, currentFrame, project.frames]);

  // Helpers
  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const cv = liveRef.current!;
    const rect = cv.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * cv.width;
    const y = ((clientY - rect.top) / rect.height) * cv.height;
    return { x, y };
  }, []);

  // Render selection overlay onto liveRef
  const renderSelectionOverlay = useCallback(() => {
    const live = liveRef.current;
    if (!live) return;
    const ctx = live.getContext("2d")!;
    ctx.clearRect(0, 0, live.width, live.height);
    if (!selection) return;

    // Draw transformed image
    ctx.save();
    ctx.translate(selection.cx, selection.cy);
    ctx.rotate(selection.rot);
    // Render the captured imageData via offscreen canvas
    const off = document.createElement("canvas");
    off.width = selection.sw;
    off.height = selection.sh;
    off.getContext("2d")!.putImageData(selection.imageData, 0, 0);
    ctx.drawImage(off, -selection.w / 2, -selection.h / 2, selection.w, selection.h);
    ctx.restore();

    // Bounding box + handles in screen-aligned but rotated frame
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
    // handles
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
    // rotation handle
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

  // Auto-cancel any active selection when the active layer / frame changes,
  // otherwise the floating pixels would leak into the wrong layer.
  const activeLayerId = frame?.activeLayerId ?? null;
  useEffect(() => {
    setSelection(null);
    dragRef.current = { kind: "none" };
    drawingRef.current.active = false;
    drawingLayerIdRef.current = null;
    const live = liveRef.current;
    if (live) live.getContext("2d")!.clearRect(0, 0, live.width, live.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerId, currentFrame]);

  // Apply selection's transformed pixels back to active layer + clear selection
  const commitSelection = useCallback(async () => {
    if (!selection || !activeLayer) return;
    const layerCv = document.createElement("canvas");
    layerCv.width = project.width;
    layerCv.height = project.height;
    const lctx = layerCv.getContext("2d")!;
    try {
      const img = await loadImage(activeLayer.dataUrl);
      lctx.drawImage(img, 0, 0);
    } catch { /* ignore */ }
    // The pixels in the source rect were already cleared at capture time;
    // now stamp the transformed selection.
    lctx.save();
    lctx.translate(selection.cx, selection.cy);
    lctx.rotate(selection.rot);
    const off = document.createElement("canvas");
    off.width = selection.sw;
    off.height = selection.sh;
    off.getContext("2d")!.putImageData(selection.imageData, 0, 0);
    lctx.drawImage(off, -selection.w / 2, -selection.h / 2, selection.w, selection.h);
    lctx.restore();
    updateActiveLayerData(layerCv.toDataURL("image/png"), selection.baseSnapshot);
    setSelection(null);
  }, [selection, activeLayer, project.width, project.height, updateActiveLayerData]);

  // Cancel selection (restore baseSnapshot)
  const cancelSelection = useCallback(() => {
    if (!selection) return;
    updateActiveLayerData(selection.baseSnapshot);
    setSelection(null);
  }, [selection, updateActiveLayerData]);

  // ESC cancels selection, Enter commits
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

  // Hit-test selection handles in canvas coords
  const hitTestSelection = (p: { x: number; y: number }): string | null => {
    if (!selection) return null;
    // Transform point into selection's local space
    const dx = p.x - selection.cx;
    const dy = p.y - selection.cy;
    const cos = Math.cos(-selection.rot);
    const sin = Math.sin(-selection.rot);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const hx = selection.w / 2;
    const hy = selection.h / 2;
    const tol = 12 / view.scale;
    // rotation handle
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

  const drawStrokeSegment = (
    ctx: CanvasRenderingContext2D,
    a: { x: number; y: number },
    b: { x: number; y: number },
    erase: boolean,
  ) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = tool.size;
    if (erase) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = hexToRgba(tool.color, tool.opacity);
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  /** Draw stroke segment + mirrored copies for Mirror Pen */
  const drawMirroredSegment = (
    ctx: CanvasRenderingContext2D,
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => {
    const w = project.width;
    const h = project.height;
    const axis = tool.mirrorAxis;
    drawStrokeSegment(ctx, a, b, false);
    if (axis === "horizontal" || axis === "both") {
      drawStrokeSegment(ctx, { x: w - a.x, y: a.y }, { x: w - b.x, y: b.y }, false);
    }
    if (axis === "vertical" || axis === "both") {
      drawStrokeSegment(ctx, { x: a.x, y: h - a.y }, { x: b.x, y: h - b.y }, false);
    }
    if (axis === "both") {
      drawStrokeSegment(ctx, { x: w - a.x, y: h - a.y }, { x: w - b.x, y: h - b.y }, false);
    }
  };

  /** Render a shape preview onto live ctx (clears first) */
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

  /** Begin a draw-into-live workflow: composite all OTHER visible layers into base
   * and render the active layer into live so we can paint directly into it. */
  const beginLiveStroke = async () => {
    if (!activeLayer || !frame) return;
    drawingRef.current.startSnapshot = activeLayer.dataUrl;
    drawingRef.current.layerId = activeLayer.id;
    drawingRef.current.frameId = frame.id;
    drawingLayerIdRef.current = activeLayer.id;
    const base = baseRef.current!;
    const bctx = base.getContext("2d")!;
    bctx.clearRect(0, 0, base.width, base.height);
    for (const layer of frame.layers) {
      if (!layer.visible) continue;
      if (layer.id === activeLayer.id) continue;
      try {
        const img = await loadImage(layer.dataUrl);
        bctx.drawImage(img, 0, 0);
      } catch { /* ignore */ }
    }
    const live = liveRef.current!;
    const lctx = live.getContext("2d")!;
    lctx.clearRect(0, 0, live.width, live.height);
    await drawActiveLayerToContext(lctx);
  };

  /** Commit live canvas into the layer that started the stroke (not whatever is
   * active right now), so layer switches mid-stroke don't corrupt data. */
  const commitLiveStroke = useCallback(() => {
    const live = liveRef.current;
    const layerId = drawingRef.current.layerId;
    const frameId = drawingRef.current.frameId;
    const snap = drawingRef.current.startSnapshot ?? undefined;
    if (live && layerId && frameId) {
      const s = useStore.getState();
      const idx = s.project.frames.findIndex((f) => f.id === frameId);
      s.updateLayerData(idx, layerId, live.toDataURL("image/png"), snap);
    }
    drawingLayerIdRef.current = null;
    drawingRef.current.layerId = null;
    drawingRef.current.frameId = null;
    drawingRef.current.startSnapshot = null;
    drawingRef.current.last = null;
    drawingRef.current.active = false;
    if (live) live.getContext("2d")!.clearRect(0, 0, live.width, live.height);
  }, []);

  // Draw the active layer (fast path) into a temp canvas — used during pencil stroke
  const drawActiveLayerToContext = async (ctx: CanvasRenderingContext2D) => {
    if (!activeLayer) return;
    try {
      const img = await loadImage(activeLayer.dataUrl);
      ctx.drawImage(img, 0, 0);
    } catch { /* ignore */ }
  };

  const onPointerDown = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = liveRef.current!;
    cv.setPointerCapture(e.pointerId);
    const p = getCanvasPoint(e.clientX, e.clientY);

    // Pan with middle mouse or shift+left
    if (e.button === 1 || (e.shiftKey && e.button === 0)) {
      panRef.current = {
        active: true, startX: e.clientX, startY: e.clientY, tx0: view.tx, ty0: view.ty,
      };
      return;
    }

    if (!activeLayer || !frame) return;

    // Selection / transform tool
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
      // Outside existing selection -> commit then start new marquee
      if (selection) await commitSelection();
      dragRef.current = { kind: "marquee", x0: p.x, y0: p.y };
      return;
    }

    // If a selection is active and another tool is used, commit first
    if (selection) await commitSelection();

    if (tool.tool === "eyedropper") {
      const base = baseRef.current!;
      const ctx = base.getContext("2d")!;
      const d = ctx.getImageData(clamp(Math.round(p.x), 0, base.width - 1), clamp(Math.round(p.y), 0, base.height - 1), 1, 1).data;
      if (d[3] > 0) setTool({ color: rgbToHex(d[0], d[1], d[2]) });
      return;
    }

    if (tool.tool === "fill") {
      // Operate ONLY on active layer
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

    // Shape tools (rectangle / circle / line)
    if (tool.tool === "rectangle" || tool.tool === "circle" || tool.tool === "line") {
      await beginLiveStroke();
      dragRef.current = { kind: "shape", shape: tool.tool, x0: p.x, y0: p.y };
      return;
    }

    // Pencil / Eraser / Mirror Pen — draw into live canvas, commit on up
    drawingRef.current.active = true;
    drawingRef.current.last = { ...p, pressure: (e as any).pressure || 0.5 };
    await beginLiveStroke();
    const live = liveRef.current!;
    const lctx = live.getContext("2d")!;
    if (tool.tool === "mirror") drawMirroredSegment(lctx, p, p);
    else drawStrokeSegment(lctx, p, p, tool.tool === "eraser");
  };

  const onPointerMove = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = getCanvasPoint(e.clientX, e.clientY);
    setCursorPos(p);

    if (panRef.current.active) {
      setView((v) => ({
        ...v,
        tx: panRef.current.tx0 + (e.clientX - panRef.current.startX),
        ty: panRef.current.ty0 + (e.clientY - panRef.current.startY),
      }));
      return;
    }

    // Selection drag
    const dr = dragRef.current;
    if (dr.kind === "marquee") {
      const live = liveRef.current!;
      const ctx = live.getContext("2d")!;
      ctx.clearRect(0, 0, live.width, live.height);
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
      // transform delta into local axis
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
      // shift center in world space
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

    // Drawing
    if (dr.kind === "shape") {
      // Re-render: active layer + shape preview on top
      const live = liveRef.current!;
      const lctx = live.getContext("2d")!;
      lctx.clearRect(0, 0, live.width, live.height);
      // restore original active-layer pixels then overlay shape
      // (we redraw from snapshot to avoid accumulating partial shapes)
      if (drawingRef.current.startSnapshot) {
        try {
          const img = await loadImage(drawingRef.current.startSnapshot);
          lctx.drawImage(img, 0, 0);
        } catch { /* ignore */ }
      }
      renderShape(lctx, dr.shape, dr.x0, dr.y0, p.x, p.y);
      return;
    }
    if (!drawingRef.current.active) return;
    const live = liveRef.current!;
    const lctx = live.getContext("2d")!;
    const last = drawingRef.current.last!;
    if (tool.tool === "pencil" || tool.tool === "eraser") {
      drawStrokeSegment(lctx, last, p, tool.tool === "eraser");
      drawingRef.current.last = { ...p, pressure: (e as any).pressure || 0.5 };
    } else if (tool.tool === "mirror") {
      drawMirroredSegment(lctx, last, p);
      drawingRef.current.last = { ...p, pressure: (e as any).pressure || 0.5 };
    }
  };

  const onPointerUp = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    try { liveRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (panRef.current.active) {
      panRef.current.active = false;
      return;
    }

    const dr = dragRef.current;
    dragRef.current = { kind: "none" };

    if (dr.kind === "shape") {
      // Note: renderShape was called in pointermove with snapshot baseline —
      // the live canvas now contains "snapshot + shape". Commit it.
      // If the user just clicked without dragging, render a single-point shape.
      const p = getCanvasPoint(e.clientX, e.clientY);
      if (drawingRef.current.startSnapshot) {
        const live = liveRef.current!;
        const lctx = live.getContext("2d")!;
        // ensure at least one render happened
        lctx.clearRect(0, 0, live.width, live.height);
        try {
          const img = await loadImage(drawingRef.current.startSnapshot);
          lctx.drawImage(img, 0, 0);
        } catch { /* ignore */ }
        renderShape(lctx, dr.shape, dr.x0, dr.y0, p.x, p.y);
      }
      commitLiveStroke();
      return;
    }

    if (dr.kind === "marquee") {
      const p = getCanvasPoint(e.clientX, e.clientY);
      const x = Math.max(0, Math.floor(Math.min(dr.x0, p.x)));
      const y = Math.max(0, Math.floor(Math.min(dr.y0, p.y)));
      const w = Math.floor(Math.abs(p.x - dr.x0));
      const h = Math.floor(Math.abs(p.y - dr.y0));
      const live = liveRef.current!;
      live.getContext("2d")!.clearRect(0, 0, live.width, live.height);
      if (w < 4 || h < 4 || !activeLayer) return;
      // Capture pixels from active layer
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
      // Clear those pixels from the layer (so the floating selection appears lifted)
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
    if (dr.kind !== "none") return; // move/resize/rotate complete; selection state already updated

    // Drawing commit (pencil / eraser)
    if (!drawingRef.current.active) return;
    drawingRef.current.active = false;
    commitLiveStroke();
  };

  // Smooth, cursor-centered zoom
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
      return { scale: newScale, tx: newTx, ty: newTy };
    });
  };

  const cssW = project.width * view.scale;
  const cssH = project.height * view.scale;

  // Cursor preview ring size in CSS pixels
  const cursorCss = tool.size * view.scale;
  const showRing =
    cursorPos !== null &&
    (tool.tool === "pencil" || tool.tool === "eraser" || tool.tool === "mirror");

  const cursorStyle =
    tool.tool === "select" ? "default"
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
        {/* Checkerboard for transparent canvas */}
        <div className="absolute inset-0 rounded-lg shadow-soft checkerboard" aria-hidden />
        <canvas
          ref={onionRef}
          className="absolute inset-0 w-full h-full pointer-events-none rounded-lg"
        />
        <canvas
          ref={baseRef}
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
        {/* Brush cursor preview */}
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
      {/* Zoom hint */}
      <div className="absolute bottom-2 left-2 text-[11px] font-semibold bg-background/70 backdrop-blur px-2 py-1 rounded-lg text-muted-foreground tabular-nums pointer-events-none">
        {Math.round(view.scale * 100)}%
      </div>
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
