import { useStore } from "@/animation/store";
import { DEFAULT_PALETTE } from "@/animation/types";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
        <Slider
          value={[tool.size]}
          min={1}
          max={80}
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

      {/* Toggles */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="mirror" className="text-sm">Mirror</Label>
          <Switch id="mirror" checked={tool.mirror} onCheckedChange={(v) => setTool({ mirror: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="pressure" className="text-sm">Pressure</Label>
          <Switch id="pressure" checked={tool.pressure} onCheckedChange={(v) => setTool({ pressure: v })} />
        </div>
      </div>
    </div>
  );
};
