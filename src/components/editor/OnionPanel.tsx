import { useStore } from "@/animation/store";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Layers } from "lucide-react";

export const OnionPanel = () => {
  const onion = useStore((s) => s.onion);
  const setOnion = useStore((s) => s.setOnion);
  return (
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
  );
};
