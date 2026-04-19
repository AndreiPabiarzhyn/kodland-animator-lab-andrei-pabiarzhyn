import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useStore } from "@/animation/store";
import { exportGif, exportPngSequence, importImageAsFrame, loadProjectFile, saveProjectFile } from "@/animation/io";
import {
  Download, Upload, FilePlus2, Save, Image as ImageIcon, Moon, Sun,
  Undo2, Redo2, ZoomIn, FileDown, Settings, HelpCircle, Sparkles,
} from "lucide-react";
import { toggleTheme } from "@/animation/hooks";
import { toast } from "sonner";
import { uid } from "@/animation/utils";
import { KodlandLogo } from "./KodlandLogo";

export const TopBar = () => {
  const project = useStore((s) => s.project);
  const setProjectMeta = useStore((s) => s.setProjectMeta);
  const newProject = useStore((s) => s.newProject);
  const loadProject = useStore((s) => s.loadProject);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const addFrame = useStore((s) => s.addFrame);
  const updateFrameData = useStore((s) => s.updateFrameData);
  const currentFrame = useStore((s) => s.currentFrame);

  const importRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newW, setNewW] = useState(800);
  const [newH, setNewH] = useState(600);
  const [showHelp, setShowHelp] = useState(false);

  const handleExportGif = async () => {
    setExporting("Rendering GIF…");
    try {
      await exportGif(project, (p) => setExporting(`Rendering GIF… ${Math.round(p * 100)}%`));
      toast.success("GIF exported!");
    } catch (e) {
      console.error(e);
      toast.error("GIF export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleExportPng = async () => {
    setExporting("Zipping PNGs…");
    try {
      await exportPngSequence(project);
      toast.success("PNG sequence saved!");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleLoadProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const p = await loadProjectFile(f);
      loadProject(p);
      toast.success("Project loaded");
    } catch {
      toast.error("Could not load project");
    } finally {
      e.target.value = "";
    }
  };

  const handleImportImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await importImageAsFrame(f);
      // Add new frame using project canvas dimensions, scaled-fit
      addFrame();
      // Wait for state, then redraw onto new frame
      requestAnimationFrame(async () => {
        const cv = document.createElement("canvas");
        cv.width = project.width;
        cv.height = project.height;
        const ctx = cv.getContext("2d")!;
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(cv.width / img.width, cv.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
          const idx = useStore.getState().currentFrame;
          updateFrameData(idx, cv.toDataURL("image/png"));
          toast.success("Image imported as frame");
        };
        img.src = dataUrl;
      });
    } catch {
      toast.error("Could not import image");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="h-14 flex items-center px-3 gap-2 border-b border-border bg-card/80 backdrop-blur z-20">
      <KodlandLogo />

      <div className="ml-2 flex items-center gap-2 min-w-0">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <Input
          value={project.name}
          onChange={(e) => setProjectMeta({ name: e.target.value })}
          className="h-8 w-44 sm:w-56 font-bold border-transparent bg-transparent hover:bg-muted focus-visible:bg-background"
          aria-label="Project name"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={undo} aria-label="Undo" title="Undo (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={redo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="gap-1.5 hidden sm:inline-flex">
              <FilePlus2 className="h-4 w-4" /> New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New animation</DialogTitle>
              <DialogDescription>Choose your canvas size. You can change it any time.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Width</label>
                <Input type="number" value={newW} onChange={(e) => setNewW(+e.target.value)} min={64} max={1920} />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground">Height</label>
                <Input type="number" value={newH} onChange={(e) => setNewH(+e.target.value)} min={64} max={1920} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
              <Button onClick={() => { newProject(newW, newH); setShowNew(false); toast.success("New project!"); }}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90 rounded-xl">
              <Download className="h-4 w-4" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={handleExportGif} className="gap-2">
              <ImageIcon className="h-4 w-4" /> Animated GIF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPng} className="gap-2">
              <FileDown className="h-4 w-4" /> PNG sequence (.zip)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => saveProjectFile(project)} className="gap-2">
              <Save className="h-4 w-4" /> Save project (.json)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="gap-1.5 rounded-xl">
              <Upload className="h-4 w-4" /> Open
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => projectRef.current?.click()} className="gap-2">
              <Save className="h-4 w-4" /> Open project (.json)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => imageRef.current?.click()} className="gap-2">
              <ImageIcon className="h-4 w-4" /> Import image as frame
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="icon" variant="ghost" onClick={() => setShowHelp(true)} aria-label="Help">
          <HelpCircle className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={toggleTheme} aria-label="Toggle theme">
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="h-4 w-4 hidden dark:inline" />
        </Button>
      </div>

      {/* hidden file inputs */}
      <input ref={projectRef} type="file" accept="application/json,.json" hidden onChange={handleLoadProject} />
      <input ref={imageRef} type="file" accept="image/*" hidden onChange={handleImportImage} />

      {/* exporting overlay */}
      {exporting && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur flex items-center justify-center animate-fade-in">
          <div className="panel p-6 flex flex-col items-center gap-3 min-w-[260px]">
            <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <div className="font-bold">{exporting}</div>
          </div>
        </div>
      )}

      {/* help dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Speed up your workflow!</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["B", "Brush"], ["P", "Pencil"], ["E", "Eraser"], ["G", "Fill"],
              ["L", "Line"], ["R", "Rectangle"], ["O", "Ellipse"], ["I", "Eyedropper"],
              ["H", "Pan"], ["M", "Toggle mirror"],
              ["[ / ]", "Brush size"], ["N", "New frame"], ["D", "Duplicate frame"],
              ["Space", "Play / Pause"], ["← / →", "Prev/Next frame"],
              ["Ctrl+Z", "Undo"], ["Ctrl+Shift+Z", "Redo"], ["Ctrl + Scroll", "Zoom"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5">
                <span className="text-muted-foreground">{v}</span>
                <kbd className="font-mono text-xs font-bold bg-background border border-border rounded px-1.5 py-0.5">{k}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
