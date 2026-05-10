import { useStore } from "@/animation/store";
import { DEFAULT_PALETTE, BRUSH_PRESETS } from "@/animation/types";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const ToolOptions = () => {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);

  return (
    <div className="space-y-4">
      {/* Color */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Color</Label>
          <input
            type="color"
            value={tool.color}
            onChange={(e) => setTool({ color: e.target.value })}
            className="h-7 w-10 rounded-md border border-border bg-transparent cursor-pointer"
            aria-label="Pick custom color"
          />
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {DEFAULT_PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setTool({ color: c })}
              aria-label={`Color ${c}`}
              className={cn(
                "h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110",
                tool.color.toLowerCase() === c.toLowerCase()
                  ? "border-primary shadow-pop scale-110"
                  : "border-border",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* Size */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Size</Label>
          <span className="text-sm font-semibold tabular-nums">{tool.size}px</span>
        </div>
        <div className="flex items-end justify-between gap-1 mb-3 px-1">
          {BRUSH_PRESETS.map((s) => {
            const active = tool.size === s;
            const visual = Math.max(4, Math.min(28, s / 3 + 4));
            return (
              <button
                key={s}
                type="button"
                onClick={() => setTool({ size: s })}
                aria-label={`Brush size ${s}px`}
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                  active
                    ? "bg-gradient-primary shadow-pop scale-105"
                    : "bg-secondary hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "block rounded-full",
                    active ? "bg-primary-foreground" : "bg-foreground/70",
                  )}
                  style={{ width: visual, height: visual }}
                />
              </button>
            );
          })}
        </div>
        <Slider
          value={[tool.size]}
          min={1}
          max={120}
          step={1}
          onValueChange={(v) => setTool({ size: v[0] })}
        />
      </div>

      {/* Opacity */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Opacity</Label>
          <span className="text-sm font-semibold tabular-nums">{Math.round(tool.opacity * 100)}%</span>
        </div>
        <Slider
          value={[Math.round(tool.opacity * 100)]}
          min={5}
          max={100}
          step={1}
          onValueChange={(v) => setTool({ opacity: v[0] / 100 })}
        />
      </div>

      {/* Mirror axis (Mirror Pen only) */}
      {tool.tool === "mirror" && (
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            Mirror Axis
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["horizontal", "vertical", "both"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setTool({ mirrorAxis: a })}
                className={cn(
                  "h-8 rounded-lg text-xs font-bold capitalize transition-all",
                  tool.mirrorAxis === a
                    ? "bg-gradient-primary text-primary-foreground shadow-pop"
                    : "bg-secondary hover:bg-muted",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Shape fill (Rectangle / Circle) */}
      {(tool.tool === "rectangle" || tool.tool === "circle") && (
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            Style
          </Label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setTool({ shapeFill: false })}
              className={cn(
                "h-8 rounded-lg text-xs font-bold transition-all",
                !tool.shapeFill
                  ? "bg-gradient-primary text-primary-foreground shadow-pop"
                  : "bg-secondary hover:bg-muted",
              )}
            >
              Outline
            </button>
            <button
              type="button"
              onClick={() => setTool({ shapeFill: true })}
              className={cn(
                "h-8 rounded-lg text-xs font-bold transition-all",
                tool.shapeFill
                  ? "bg-gradient-primary text-primary-foreground shadow-pop"
                  : "bg-secondary hover:bg-muted",
              )}
            >
              Fill
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
