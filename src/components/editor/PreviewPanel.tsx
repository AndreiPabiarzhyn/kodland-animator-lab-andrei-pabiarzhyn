import { useEffect, useRef, useState } from "react";
import { useStore } from "@/animation/store";
import { loadImage } from "@/animation/utils";
import { Play, Pause, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PreviewPanel = () => {
  const project = useStore((s) => s.project);
  const setProjectMeta = useStore((s) => s.setProjectMeta);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [idx, setIdx] = useState(0);
  const rafRef = useRef<number>();
  const lastTickRef = useRef<number>(0);

  // Keep idx in range when frames are added/removed
  useEffect(() => {
    setIdx((i) => Math.min(i, Math.max(0, project.frames.length - 1)));
  }, [project.frames.length]);

  // Render current preview frame
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.width = project.width;
    cv.height = project.height;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const frame = project.frames[idx];
    if (!frame) return;
    let cancelled = false;
    (async () => {
      for (const layer of frame.layers) {
        if (!layer.visible) continue;
        try {
          const img = await loadImage(layer.dataUrl);
          if (cancelled) return;
          ctx.drawImage(img, 0, 0);
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [idx, project.frames, project.width, project.height]);

  useEffect(() => {
    if (!playing) return;
    const tick = (t: number) => {
      const interval = 1000 / project.fps;
      if (!lastTickRef.current) lastTickRef.current = t;
      if (t - lastTickRef.current >= interval) {
        lastTickRef.current = t;
        setIdx((i) => {
          const next = i + 1;
          if (next >= project.frames.length) return project.loop ? 0 : i;
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = 0;
    };
  }, [playing, project.fps, project.frames.length, project.loop]);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Preview</h3>
      <div className="rounded-xl overflow-hidden bg-canvas border border-border relative aspect-[4/3] flex items-center justify-center">
        <div className="relative w-full h-full flex items-center justify-center p-2">
          <div
            className="relative max-w-full max-h-full"
            style={{ aspectRatio: `${project.width} / ${project.height}` }}
          >
            <div className="absolute inset-0 checkerboard rounded-md" />
            <canvas
              ref={canvasRef}
              className="relative w-full h-full rounded-md"
              style={{ display: "block" }}
            />
          </div>
        </div>
        <div className="absolute bottom-1 right-1 bg-background/70 backdrop-blur px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums">
          {idx + 1}/{project.frames.length}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          onClick={() => setPlaying((p) => !p)}
          className={cn(
            "rounded-lg gap-1.5 flex-1",
            playing ? "bg-warning text-warning-foreground hover:bg-warning/90" : "bg-gradient-primary text-primary-foreground",
          )}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {playing ? "Pause" : "Play"}
        </Button>
        <button
          onClick={() => setProjectMeta({ loop: !project.loop })}
          className={cn(
            "h-8 px-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors",
            project.loop ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground",
          )}
          aria-pressed={project.loop}
          title="Loop"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
