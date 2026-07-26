import { useStore } from "@/animation/store";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Layers } from "lucide-react";
import { useI18n } from "@/i18n";

export const OnionPanel = () => {
  const onion = useStore((s) => s.onion);
  const setOnion = useStore((s) => s.setOnion);
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <Label htmlFor="onion" className="text-sm font-semibold">{t("onionSkin")}</Label>
      </div>
      <Switch
        id="onion"
        checked={onion.enabled}
        onCheckedChange={(v) => setOnion({ enabled: v })}
      />
    </div>
  );
};
