import { useState } from "react";
import { useStore } from "@/animation/store";
import { Eye, EyeOff, Plus, Copy, Trash2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export const LayersPanel = () => {
  const project = useStore((s) => s.project);
  const currentFrame = useStore((s) => s.currentFrame);
  const addLayer = useStore((s) => s.addLayer);
  const duplicateLayer = useStore((s) => s.duplicateLayer);
  const deleteLayer = useStore((s) => s.deleteLayer);
  const moveLayer = useStore((s) => s.moveLayer);
  const renameLayer = useStore((s) => s.renameLayer);
  const toggleVisible = useStore((s) => s.toggleLayerVisible);
  const setActive = useStore((s) => s.setActiveLayer);
  const { t } = useI18n();

  const frame = project.frames[currentFrame];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  if (!frame) return null;

  // Display top-most layer first (last in array = drawn on top)
  const display = frame.layers.map((l, i) => ({ layer: l, i })).reverse();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t("layers")}</h3>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addLayer()} title={t("addLayer")}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateLayer()} title={t("duplicateLayer")}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => deleteLayer()}
            disabled={frame.layers.length <= 1}
            title={t("deleteLayer")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>{t("topLayer")}</span>
        <span>{t("bottomLayer")}</span>
      </div>
      <div className="flex flex-col gap-1 max-h-80 overflow-y-auto scrollbar-thin">
        {display.map(({ layer, i }) => {
          const active = layer.id === frame.activeLayerId;
          const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
          const displayOrder = frame.layers.length - i;
          return (
            <div
              key={layer.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== i) moveLayer(dragIdx, i);
                setDragIdx(null); setOverIdx(null);
              }}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              onClick={() => setActive(layer.id)}
              className={cn(
                "group flex items-center gap-1.5 rounded-lg px-2 py-2 cursor-pointer transition-colors border",
                active
                  ? "bg-primary/10 border-primary"
                  : "bg-card border-transparent hover:bg-muted",
                isOver && "ring-2 ring-accent",
              )}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="w-5 text-center text-[10px] font-black text-muted-foreground tabular-nums" title={`Layer ${displayOrder}`}>
                {displayOrder}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); toggleVisible(layer.id); }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                 aria-label={layer.visible ? t("hideLayer") : t("showLayer")}
              >
                {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 opacity-50" />}
              </button>
              <div className="h-9 w-12 rounded checkerboard relative overflow-hidden shrink-0 border border-border">
                <img src={layer.dataUrl} alt="" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
              </div>
              {editingId === layer.id ? (
                <Input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => { renameLayer(layer.id, draftName.trim() || layer.name); setEditingId(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="h-6 text-xs flex-1"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <button
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingId(layer.id); setDraftName(layer.name); }}
                  className={cn("flex-1 text-left text-xs truncate font-semibold", !layer.visible && "opacity-50")}
                   title={t("renameLayer")}
                >
                  <span className="block">{layer.name}</span>
                  {active && <span className="block text-[9px] uppercase tracking-wider text-primary">{t("activeLayer")}</span>}
                </button>
              )}
              <div className="flex shrink-0 flex-col opacity-60 group-hover:opacity-100">
                <button
                  type="button"
                  disabled={i === frame.layers.length - 1}
                  onClick={(e) => { e.stopPropagation(); moveLayer(i, i + 1); }}
                  className="h-4 w-5 rounded hover:bg-muted disabled:invisible"
                  aria-label={t("moveLayerUp")}
                  title={t("moveLayerUp")}
                >
                  <ChevronUp className="mx-auto h-3 w-3" />
                </button>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={(e) => { e.stopPropagation(); moveLayer(i, i - 1); }}
                  className="h-4 w-5 rounded hover:bg-muted disabled:invisible"
                  aria-label={t("moveLayerDown")}
                  title={t("moveLayerDown")}
                >
                  <ChevronDown className="mx-auto h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
