import { TopBar } from "@/components/editor/TopBar";
import { ToolPalette } from "@/components/editor/ToolPalette";
import { ToolOptions } from "@/components/editor/ToolOptions";
import { OnionPanel } from "@/components/editor/OnionPanel";
import { Timeline } from "@/components/editor/Timeline";
import { DrawingCanvas } from "@/components/editor/DrawingCanvas";
import { LayersPanel } from "@/components/editor/LayersPanel";
import { PreviewPanel } from "@/components/editor/PreviewPanel";
import { useAutosave, useShortcuts, useTheme } from "@/animation/hooks";

const Index = () => {
  useTheme();
  useAutosave();
  useShortcuts();

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      <header>
        <TopBar />
      </header>

      <main className="flex-1 min-h-0 flex">
        {/* Left tools panel */}
        <aside className="w-[260px] shrink-0 border-r border-border bg-card/50 backdrop-blur p-3 overflow-y-auto scrollbar-thin space-y-4">
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Tools</h2>
            <ToolPalette />
          </section>
          <section className="panel p-3">
            <ToolOptions />
          </section>
          <section className="panel p-3">
            <OnionPanel />
          </section>
          <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
            Tip: scroll to zoom, hold <kbd className="font-mono bg-muted px-1 rounded">Shift</kbd> + drag to pan.
          </p>
        </aside>

        {/* Canvas area */}
        <section className="flex-1 min-w-0 flex flex-col">
          <DrawingCanvas className="flex-1 min-h-0" />
          <div className="p-3 pt-0">
            <Timeline />
          </div>
        </section>

        {/* Right preview + layers panel */}
        <aside className="w-[280px] shrink-0 border-l border-border bg-card/50 backdrop-blur p-3 overflow-y-auto scrollbar-thin space-y-4">
          <section className="panel p-3">
            <PreviewPanel />
          </section>
          <section className="panel p-3">
            <LayersPanel />
          </section>
        </aside>
      </main>

      <footer className="h-8 shrink-0 border-t border-border bg-card/60 backdrop-blur px-4 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Created by <span className="font-bold text-foreground">Andrei Pobiarzhyn</span></span>
        <span className="hidden sm:inline">KodFlip — frame-by-frame animation studio</span>
      </footer>
    </div>
  );
};

export default Index;
