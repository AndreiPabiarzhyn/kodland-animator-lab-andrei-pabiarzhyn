import { useStore } from "@/animation/store";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Layers } from "lucide-react";

export const OnionPanel = () => {
  const onion = useStore((s) => s.onion);
  const setOnion = useStore((s) => s.setOnion);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <Label htmlFor="onion" className="text-sm font-semibold">Onion Skin</Label>
        </div>
        <Switch
          id="onion"
          checked={onion.enabled}
          onCheckedChange={(v) => setOnion({ enabled: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Prev</span>
            <span className="tabular-nums">{onion.prev}</span>
          </div>
          <Slider
            disabled={!onion.enabled}
            value={[onion.prev]}
            min={0}
            max={5}
            step={1}
            onValueChange={(v) => setOnion({ prev: v[0] })}
          />
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Next</span>
            <span className="tabular-nums">{onion.next}</span>
          </div>
          <Slider
            disabled={!onion.enabled}
            value={[onion.next]}
            min={0}
            max={5}
            step={1}
            onValueChange={(v) => setOnion({ next: v[0] })}
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Opacity</span>
          <span className="tabular-nums">{Math.round(onion.opacity * 100)}%</span>
        </div>
        <Slider
          disabled={!onion.enabled}
          value={[Math.round(onion.opacity * 100)]}
          min={5}
          max={80}
          step={1}
          onValueChange={(v) => setOnion({ opacity: v[0] / 100 })}
        />
      </div>
    </div>
  );
};
