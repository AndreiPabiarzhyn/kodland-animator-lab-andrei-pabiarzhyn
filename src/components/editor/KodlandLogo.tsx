export const KodlandLogo = ({ className = "" }: { className?: string }) => (
  <div className={"flex items-center gap-2 " + className} aria-label="Kodland">
    <div className="relative h-9 w-9 rounded-xl bg-gradient-fun grid place-items-center shadow-pop">
      <span className="text-white font-black text-base leading-none">K</span>
      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-warning border-2 border-card" />
    </div>
    <div className="leading-none hidden sm:block">
      <div className="font-black text-sm tracking-tight">Kodland</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">KodFlip</div>
    </div>
  </div>
);
