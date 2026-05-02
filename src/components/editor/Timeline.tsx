import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/animation/store";
import { Plus, Copy, Trash2, Play, Pause, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Frame } from "@/animation/types";
import { loadImage } from "@/animation/utils";

const FrameThumb = ({ frame, w, h }: { frame: Frame; w: number; h: number }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  // Re-render when any layer dataUrl changes
  const sig = useMemo(
    () => frame.layers.map((l) => `${l.id}:${l.visible ? 1 : 0}:${l.dataUrl.length}:${l.dataUrl.slice(-12)}`).join("|"),
    [frame.layers],
  );
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    let cancelled = false;
    (async () => {
      for (const l of frame.layers) {
        if (!l.visible) continue;
        try {
          const img = await loadImage(l.dataUrl);
          if (cancelled) return;
          ctx.drawImage(img, 0, 0, w, h);
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [sig, w, h, frame.layers]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
};

export const Timeline = () => {
  const project = useStore((s) => s.project);
  const currentFrame = useStore((s) => s.currentFrame);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const addFrame = useStore((s) => s.addFrame);
  const duplicateFrame = useStore((s) => s.duplicateFrame);
  const deleteFrame = useStore((s) => s.deleteFrame);
  const moveFrame = useStore((s) => s.moveFrame);
  const setProjectMeta = useStore((s) => s.setProjectMeta);
  const isPlaying = useStore((s) => s.isPlaying);
  const play = useStore((s) => s.play);
  const pause = useStore((s) => s.pause);

  const rafRef = useRef<number>();
  const lastTickRef = useRef<number>(0);
  useEffect(() => {
    if (!isPlaying) return;
    const tick = (t: number) => {
      const interval = 1000 / project.fps;
      if (!lastTickRef.current) lastTickRef.current = t;
      if (t - lastTickRef.current >= interval) {
        lastTickRef.current = t;
        const s = useStore.getState();
        const last = s.project.frames.length - 1;
        let next = s.currentFrame + 1;
        if (next > last) {
          if (s.project.loop) next = 0;
          else { pause(); return; }
        }
        useStore.setState({ currentFrame: next });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = 0;
    };
  }, [isPlaying, project.fps, pause]);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const thumbW = 112;
  const thumbH = Math.round(thumbW * (project.height / project.width));

  return (
    <div className="panel p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => (isPlaying ? pause() : play())}
          className={cn(
            "rounded-xl font-bold gap-2",
            isPlaying ? "bg-warning text-warning-foreground hover:bg-warning/90" : "bg-gradient-primary text-primary-foreground",
          )}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {isPlaying ? "Pause" : "Play"}
        </Button>

        <Button size="sm" variant="secondary" className="rounded-xl gap-1.5" onClick={() => addFrame()}>
          <Plus className="h-4 w-4" /> Frame
        </Button>
        <Button size="sm" variant="secondary" className="rounded-xl gap-1.5" onClick={() => duplicateFrame()}>
          <Copy className="h-4 w-4" /> Duplicate
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => deleteFrame()}
          disabled={project.frames.length <= 1}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setProjectMeta({ loop: !project.loop })}
            className={cn(
              "h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors",
              project.loop ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground",
            )}
            aria-pressed={project.loop}
          >
            <RotateCw className="h-3.5 w-3.5" />
            Loop
          </button>
          <div className="flex items-center gap-2 min-w-[180px]">
            <span className="text-xs font-bold uppercase text-muted-foreground">FPS</span>
            <Slider
              value={[project.fps]}
              min={1}
              max={30}
              step={1}
              onValueChange={(v) => setProjectMeta({ fps: v[0] })}
              className="w-28"
            />
            <span className="text-sm font-bold tabular-nums w-6 text-right">{project.fps}</span>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            Frame <span className="font-bold text-foreground">{currentFrame + 1}</span> / {project.frames.length}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2 -mx-1 px-1">
        {project.frames.map((f, i) => (
          <button
            key={f.id}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
            onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx !== null && dragIdx !== i) moveFrame(dragIdx, i);
              setDragIdx(null);
              setOverIdx(null);
            }}
            onClick={() => setCurrentFrame(i)}
            className={cn(
              "relative shrink-0 rounded-xl transition-all overflow-hidden border-2",
              "bg-card",
              i === currentFrame
                ? "border-primary shadow-pop ring-2 ring-primary/40"
                : "border-border hover:border-muted-foreground/40",
              overIdx === i && dragIdx !== null && dragIdx !== i && "ring-2 ring-accent",
            )}
            style={{ width: thumbW, height: thumbH + 4 }}
            aria-label={`Frame ${i + 1}`}
          >
            <div className="absolute inset-0 checkerboard" />
            <FrameThumb frame={f} w={thumbW} h={thumbH} />
            <span className="absolute top-1 left-1 text-[10px] font-bold bg-background/80 backdrop-blur px-1.5 py-0.5 rounded-md tabular-nums">
              {i + 1}
            </span>
          </button>
        ))}
        <button
          onClick={() => addFrame()}
          className="shrink-0 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-center text-muted-foreground hover:text-primary"
          style={{ width: thumbW, height: thumbH + 4 }}
          aria-label="Add frame"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};
