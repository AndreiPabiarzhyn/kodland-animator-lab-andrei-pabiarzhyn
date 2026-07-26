import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
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
  Undo2, Redo2, FileDown, HelpCircle, Sparkles,
} from "lucide-react";
import { toggleTheme } from "@/animation/hooks";
import { toast } from "sonner";
import { KodlandLogo } from "./KodlandLogo";
import { PlanetIcon } from "./PlanetIcon";
import { LANGUAGES, useI18n } from "@/i18n";

export const TopBar = () => {
  const { language, setLanguage, t } = useI18n();
  const project = useStore((s) => s.project);
  const setProjectMeta = useStore((s) => s.setProjectMeta);
  const newProject = useStore((s) => s.newProject);
  const loadProject = useStore((s) => s.loadProject);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const addFrame = useStore((s) => s.addFrame);
  const updateActiveLayerData = useStore((s) => s.updateActiveLayerData);

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
      toast.success(t("gifExported"));
    } catch (e) {
      console.error(e);
      toast.error(t("gifExportFailed"));
    } finally {
      setExporting(null);
    }
  };

  const handleExportPng = async () => {
    setExporting("Zipping PNGs…");
    try {
      await exportPngSequence(project);
      toast.success(t("pngSaved"));
    } catch {
      toast.error(t("exportFailed"));
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
      toast.success(t("projectLoaded"));
    } catch {
      toast.error(t("projectLoadFailed"));
    } finally {
      e.target.value = "";
    }
  };

  const handleImportImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await importImageAsFrame(f);
      addFrame();
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
          updateActiveLayerData(cv.toDataURL("image/png"));
          toast.success(t("imageImported"));
        };
        img.src = dataUrl;
      });
    } catch {
      toast.error(t("imageImportFailed"));
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
           aria-label={t("projectName")}
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
         <Button size="icon" variant="ghost" onClick={undo} aria-label={t("undo")} title={`${t("undo")} (Ctrl+Z)`}>
          <Undo2 className="h-4 w-4" />
        </Button>
         <Button size="icon" variant="ghost" onClick={redo} aria-label={t("redo")} title={`${t("redo")} (Ctrl+Shift+Z)`}>
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="gap-1.5 hidden sm:inline-flex">
               <FilePlus2 className="h-4 w-4" /> {t("new")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
             <DialogTitle>{t("newAnimation")}</DialogTitle>
             <DialogDescription>{t("chooseCanvas")}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                 <label className="text-xs font-bold text-muted-foreground">{t("width")}</label>
                <Input type="number" value={newW} onChange={(e) => setNewW(+e.target.value)} min={64} max={1920} />
              </div>
              <div>
                 <label className="text-xs font-bold text-muted-foreground">{t("height")}</label>
                <Input type="number" value={newH} onChange={(e) => setNewH(+e.target.value)} min={64} max={1920} />
              </div>
            </div>
            <DialogFooter>
               <Button variant="ghost" onClick={() => setShowNew(false)}>{t("cancel")}</Button>
               <Button onClick={() => { newProject(newW, newH); setShowNew(false); toast.success(t("newProjectCreated")); }}>
                 {t("create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5 bg-gradient-primary text-primary-foreground hover:opacity-90 rounded-xl">
               <Download className="h-4 w-4" /> {t("export")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={handleExportGif} className="gap-2">
               <ImageIcon className="h-4 w-4" /> {t("animatedGif")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPng} className="gap-2">
               <FileDown className="h-4 w-4" /> {t("pngSequence")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => saveProjectFile(project)} className="gap-2">
               <Save className="h-4 w-4" /> {t("saveProject")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="gap-1.5 rounded-xl">
               <Upload className="h-4 w-4" /> {t("open")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => projectRef.current?.click()} className="gap-2">
               <Save className="h-4 w-4" /> {t("openProject")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => imageRef.current?.click()} className="gap-2">
               <ImageIcon className="h-4 w-4" /> {t("importImage")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

         <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <Button size="icon" variant="ghost" aria-label={t("language")} title={t("language")}>
               <PlanetIcon className="h-4 w-4" />
             </Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent align="end" className="w-48">
             <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
             <DropdownMenuSeparator />
             {LANGUAGES.map((item) => (
               <DropdownMenuItem key={item.id} onClick={() => setLanguage(item.id)} className="gap-2">
                 <span className={item.id === language ? "font-bold text-primary" : ""}>{item.label}</span>
               </DropdownMenuItem>
             ))}
           </DropdownMenuContent>
         </DropdownMenu>

         <Button size="icon" variant="ghost" onClick={() => setShowHelp(true)} aria-label={t("help")}>
          <HelpCircle className="h-4 w-4" />
        </Button>
         <Button size="icon" variant="ghost" onClick={toggleTheme} aria-label={t("toggleTheme")}>
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
             <DialogTitle>{t("keyboardShortcuts")}</DialogTitle>
             <DialogDescription>{t("speedWorkflow")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["P", "Pencil"], ["E", "Eraser"], ["G", "Fill"],
              ["S", "Select / Transform"], ["I", "Color picker"],
              ["[ / ]", "Tool size"], ["N", "New frame"], ["D", "Duplicate frame"],
              ["Space", "Play / Pause"], ["← / →", "Prev/Next frame"],
              ["Ctrl+Z", "Undo"], ["Ctrl+Shift+Z", "Redo"], ["Scroll", "Zoom"],
              ["Shift+Drag", "Pan canvas"], ["Enter / Esc", "Apply / Cancel selection"],
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
