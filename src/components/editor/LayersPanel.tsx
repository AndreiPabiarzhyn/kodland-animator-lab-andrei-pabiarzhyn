import { useState } from "react";
import { useStore } from "@/animation/store";
import { Eye, EyeOff, Plus, Copy, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Layers</h3>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => addLayer()} title="Add layer">
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateLayer()} title="Duplicate layer">
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => deleteLayer()}
            disabled={frame.layers.length <= 1}
            title="Delete layer"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto scrollbar-thin">
        {display.map(({ layer, i }) => {
          const active = layer.id === frame.activeLayerId;
          const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
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
                "group flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors border",
                active
                  ? "bg-primary/10 border-primary"
                  : "bg-card border-transparent hover:bg-muted",
                isOver && "ring-2 ring-accent",
              )}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <button
                onClick={(e) => { e.stopPropagation(); toggleVisible(layer.id); }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={layer.visible ? "Hide layer" : "Show layer"}
              >
                {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 opacity-50" />}
              </button>
              <div className="h-7 w-9 rounded checkerboard relative overflow-hidden shrink-0 border border-border">
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
                  title="Double-click to rename"
                >
                  {layer.name}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
