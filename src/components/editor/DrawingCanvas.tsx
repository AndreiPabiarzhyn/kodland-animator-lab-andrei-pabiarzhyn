import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "@/animation/store";
import { floodFill, hexToRgba, hexToRgbArr, loadImage, rgbToHex } from "@/animation/utils";

type Point = { x: number; y: number; pressure: number };

interface Props {
  className?: string;
}

export const DrawingCanvas = ({ className }: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null); // current frame committed pixels
  const liveRef = useRef<HTMLCanvasElement>(null); // overlay for in-progress strokes/shapes
  const onionRef = useRef<HTMLCanvasElement>(null); // onion skin under base

  const project = useStore((s) => s.project);
  const currentFrame = useStore((s) => s.currentFrame);
  const tool = useStore((s) => s.tool);
  const onion = useStore((s) => s.onion);
  const setTool = useStore((s) => s.setTool);
  const updateFrameData = useStore((s) => s.updateFrameData);

  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const drawingRef = useRef<{
    active: boolean;
    points: Point[];
    startSnapshot: string | null;
    startX: number;
    startY: number;
    pointerId?: number;
  }>({ active: false, points: [], startSnapshot: null, startX: 0, startY: 0 });
  const panRef = useRef<{ active: boolean; startX: number; startY: number; tx0: number; ty0: number }>({
    active: false, startX: 0, startY: 0, tx0: 0, ty0: 0,
  });

  // Fit canvas to container initially
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.width, project.height]);

  // Render base (current frame) when frame changes
  useEffect(() => {
    const cv = baseRef.current;
    if (!cv) return;
    cv.width = project.width;
    cv.height = project.height;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const frame = project.frames[currentFrame];
    if (!frame) return;
    loadImage(frame.dataUrl).then((img) => {
      // re-check frame still current
      const cur = useStore.getState().currentFrame;
      if (cur !== currentFrame) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0);
    });
    // resize live & onion to match
    if (liveRef.current) {
      liveRef.current.width = project.width;
      liveRef.current.height = project.height;
    }
    if (onionRef.current) {
      onionRef.current.width = project.width;
      onionRef.current.height = project.height;
    }
  }, [currentFrame, project.frames, project.width, project.height]);

  // Render onion skin
  useEffect(() => {
    const cv = onionRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!onion.enabled) return;

    const drawN = async (offsets: number[], tint: string) => {
      for (const off of offsets) {
        const idx = currentFrame + off;
        if (idx < 0 || idx >= project.frames.length) continue;
        const distance = Math.abs(off);
        const alpha = onion.opacity * Math.max(0.15, 1 - (distance - 1) * 0.35);
        try {
          const img = await loadImage(project.frames[idx].dataUrl);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.drawImage(img, 0, 0);
          // tint: composite color on top of drawn content
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = tint;
          ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.restore();
        } catch {
          /* ignore */
        }
      }
    };

    const prevOff = Array.from({ length: onion.prev }, (_, i) => -(i + 1));
    const nextOff = Array.from({ length: onion.next }, (_, i) => i + 1);
    drawN(prevOff, "#ef4f6b");
    drawN(nextOff, "#3da9fc");
  }, [onion, currentFrame, project.frames, project.width, project.height]);

  // Helpers
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const cv = liveRef.current!;
    const rect = cv.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * cv.width;
    const y = ((e.clientY - rect.top) / rect.height) * cv.height;
    const pressure =
      tool.pressure && (e as any).pressure && (e as any).pressure > 0
        ? (e as any).pressure
        : 0.5;
    return { x, y, pressure };
  };

  const commitLiveToBase = () => {
    const base = baseRef.current!;
    const live = liveRef.current!;
    const ctx = base.getContext("2d")!;
    ctx.drawImage(live, 0, 0);
    const url = base.toDataURL("image/png");
    updateFrameData(currentFrame, url, drawingRef.current.startSnapshot ?? undefined);
    // clear overlay
    live.getContext("2d")!.clearRect(0, 0, live.width, live.height);
  };

  const drawStrokeSegment = (
    ctx: CanvasRenderingContext2D,
    a: Point,
    b: Point,
    erase: boolean,
  ) => {
    const baseSize = tool.size;
    const sz =
      tool.pressure && tool.tool === "brush"
        ? Math.max(0.5, baseSize * (0.3 + b.pressure * 1.4))
        : baseSize;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = sz;
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
    if (tool.mirror) {
      ctx.beginPath();
      ctx.moveTo(ctx.canvas.width - a.x, a.y);
      ctx.lineTo(ctx.canvas.width - b.x, b.y);
      ctx.stroke();
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = liveRef.current!;
    cv.setPointerCapture(e.pointerId);
    // Pan with middle mouse, space-pan tool, or two-finger? Use tool=pan or middle button.
    if (tool.tool === "pan" || e.button === 1 || (e.shiftKey && e.button === 0)) {
      panRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        tx0: view.tx,
        ty0: view.ty,
      };
      return;
    }

    const p = getCanvasPoint(e);
    const base = baseRef.current!;

    if (tool.tool === "eyedropper") {
      const ctx = base.getContext("2d")!;
      const d = ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data;
      if (d[3] > 0) setTool({ color: rgbToHex(d[0], d[1], d[2]) });
      return;
    }

    if (tool.tool === "fill") {
      const snapshot = base.toDataURL("image/png");
      const ctx = base.getContext("2d")!;
      const img = ctx.getImageData(0, 0, base.width, base.height);
      const [r, g, b] = hexToRgbArr(tool.color);
      floodFill(img, Math.round(p.x), Math.round(p.y), [r, g, b, Math.round(tool.opacity * 255)], 8);
      ctx.putImageData(img, 0, 0);
      if (tool.mirror) {
        const img2 = ctx.getImageData(0, 0, base.width, base.height);
        floodFill(img2, base.width - Math.round(p.x), Math.round(p.y), [r, g, b, Math.round(tool.opacity * 255)], 8);
        ctx.putImageData(img2, 0, 0);
      }
      updateFrameData(currentFrame, base.toDataURL("image/png"), snapshot);
      return;
    }

    drawingRef.current = {
      active: true,
      points: [p],
      startSnapshot: base.toDataURL("image/png"),
      startX: p.x,
      startY: p.y,
      pointerId: e.pointerId,
    };

    if (tool.tool === "brush" || tool.tool === "pencil" || tool.tool === "eraser") {
      // dot at start
      const ctx = liveRef.current!.getContext("2d")!;
      drawStrokeSegment(ctx, p, p, tool.tool === "eraser");
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panRef.current.active) {
      setView((v) => ({
        ...v,
        tx: panRef.current.tx0 + (e.clientX - panRef.current.startX),
        ty: panRef.current.ty0 + (e.clientY - panRef.current.startY),
      }));
      return;
    }
    if (!drawingRef.current.active) return;
    const p = getCanvasPoint(e);
    const live = liveRef.current!;
    const ctx = live.getContext("2d")!;

    if (tool.tool === "brush" || tool.tool === "pencil" || tool.tool === "eraser") {
      const prev = drawingRef.current.points[drawingRef.current.points.length - 1];
      drawingRef.current.points.push(p);
      if (tool.tool === "eraser") {
        // eraser draws to BASE directly so it removes from committed pixels
        const baseCtx = baseRef.current!.getContext("2d")!;
        drawStrokeSegment(baseCtx, prev, p, true);
      } else {
        drawStrokeSegment(ctx, prev, p, false);
      }
    } else if (tool.tool === "line") {
      ctx.clearRect(0, 0, live.width, live.height);
      ctx.lineCap = "round";
      ctx.lineWidth = tool.size;
      ctx.strokeStyle = hexToRgba(tool.color, tool.opacity);
      ctx.beginPath();
      ctx.moveTo(drawingRef.current.startX, drawingRef.current.startY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      if (tool.mirror) {
        ctx.beginPath();
        ctx.moveTo(live.width - drawingRef.current.startX, drawingRef.current.startY);
        ctx.lineTo(live.width - p.x, p.y);
        ctx.stroke();
      }
    } else if (tool.tool === "rect" || tool.tool === "ellipse") {
      ctx.clearRect(0, 0, live.width, live.height);
      ctx.lineWidth = tool.size;
      ctx.strokeStyle = hexToRgba(tool.color, tool.opacity);
      const sx = drawingRef.current.startX;
      const sy = drawingRef.current.startY;
      const w = p.x - sx;
      const h = p.y - sy;
      if (tool.tool === "rect") {
        ctx.strokeRect(sx, sy, w, h);
        if (tool.mirror) ctx.strokeRect(live.width - sx - w, sy, w, h);
      } else {
        ctx.beginPath();
        ctx.ellipse(sx + w / 2, sy + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
        if (tool.mirror) {
          ctx.beginPath();
          ctx.ellipse(live.width - (sx + w / 2), sy + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try { liveRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (panRef.current.active) {
      panRef.current.active = false;
      return;
    }
    if (!drawingRef.current.active) return;
    drawingRef.current.active = false;

    if (tool.tool === "eraser") {
      // already on base, just commit dataUrl with snapshot
      const base = baseRef.current!;
      updateFrameData(currentFrame, base.toDataURL("image/png"), drawingRef.current.startSnapshot ?? undefined);
    } else {
      commitLiveToBase();
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setView((v) => ({ ...v, scale: Math.max(0.2, Math.min(5, v.scale * (1 + delta))) }));
  };

  const cssW = project.width * view.scale;
  const cssH = project.height * view.scale;
  const cursor =
    tool.tool === "pan" ? "grab"
    : tool.tool === "eyedropper" ? "crosshair"
    : tool.tool === "fill" ? "cell"
    : "crosshair";

  return (
    <div
      ref={wrapRef}
      className={"relative overflow-hidden bg-canvas " + (className ?? "")}
      onWheel={onWheel}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: cssW,
          height: cssH,
          transform: `translate(calc(-50% + ${view.tx}px), calc(-50% + ${view.ty}px))`,
        }}
      >
        {/* Paper */}
        <div
          className="absolute inset-0 rounded-lg shadow-soft checkerboard"
          aria-hidden
        />
        <div
          className="absolute inset-0 rounded-lg"
          style={{ background: project.bgColor === "transparent" ? "transparent" : project.bgColor }}
          aria-hidden
        />
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
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
};
