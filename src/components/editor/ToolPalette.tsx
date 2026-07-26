import { Eraser, PaintBucket, Pipette, Pencil, BoxSelect, FlipHorizontal, Square, Circle, Minus, Hand } from "lucide-react";
import { ToolId } from "@/animation/types";
import { useStore } from "@/animation/store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/i18n";

const TOOLS: Array<{ id: ToolId; label: TranslationKey; key: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "pencil", label: "pencil", key: "P", icon: Pencil },
  { id: "eraser", label: "eraser", key: "E", icon: Eraser },
  { id: "fill", label: "fill", key: "G", icon: PaintBucket },
  { id: "mirror", label: "mirrorPen", key: "M", icon: FlipHorizontal },
  { id: "rectangle", label: "rectangle", key: "R", icon: Square },
  { id: "circle", label: "ellipse", key: "C", icon: Circle },
  { id: "line", label: "line", key: "L", icon: Minus },
  { id: "select", label: "selectTransform", key: "S", icon: BoxSelect },
  { id: "eyedropper", label: "colorPicker", key: "I", icon: Pipette },
  { id: "pan", label: "movePan", key: "H", icon: Hand },
];

export const ToolPalette = () => {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const { t } = useI18n();

  return (
    <TooltipProvider delayDuration={250}>
      <div className="grid grid-cols-2 gap-2">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = tool.tool === t.id;
          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={t(t.label)}
                  onClick={() => setTool({ tool: t.id })}
                  className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center transition-all",
                    "hover:scale-105 active:scale-95",
                    active
                      ? "bg-gradient-primary text-primary-foreground shadow-pop"
                      : "bg-secondary text-secondary-foreground hover:bg-muted shadow-tool",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                 <span className="font-semibold">{t(t.label)}</span>
                <span className="ml-2 text-xs opacity-70">{t.key}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
