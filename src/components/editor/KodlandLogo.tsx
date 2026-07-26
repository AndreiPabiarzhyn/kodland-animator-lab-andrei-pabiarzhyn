export const KodlandLogo = ({ className = "" }: { className?: string }) => (
  <div className={"flex items-center gap-2 " + className} aria-label="KodFlip">
    <img src="/kodflip-mark.svg" alt="KodFlip" className="h-9 w-9 rounded-xl shadow-pop" />
    <div className="leading-none hidden sm:block">
      <div className="font-black text-sm tracking-tight">KodFlip</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Animation Studio</div>
    </div>
  </div>
);
