"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { briefSections } from "@/config/brief-sections";

export function BriefToc() {
  const [active, setActive] = useState<string>(briefSections[0][0]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string = briefSections[0][0];
      for (const [id] of briefSections) {
        const section = document.getElementById(`brief-${id}`);
        if (section && section.getBoundingClientRect().top <= 150) current = id;
      }
      setActive((previous) => previous === current ? previous : current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update(); window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, []);
  return <aside className="min-w-0 rounded-xl border bg-background p-3 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto" aria-label="Navigation documentaire">
    <div className="hidden pb-3 text-sm font-semibold xl:block">Sommaire</div>
    <Button variant="ghost" className="w-full justify-between xl:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="document-toc"><List aria-hidden="true" className="size-4" />Sommaire<span className="text-xs text-muted-foreground">{open ? "Masquer" : "Afficher"}</span></Button>
    <nav id="document-toc" aria-label="Sommaire du cahier des charges" className={`${open ? "block" : "hidden"} xl:block`}><ol className="space-y-0.5">{briefSections.map(([id, title], index) => <li key={id}><a href={`#brief-${id}`} aria-current={active === id ? "location" : undefined} className={`flex gap-2 rounded-lg px-2 py-2 text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60"}`} onClick={(event) => {
      const target = document.getElementById(`brief-${id}`); if (!target) return;
      event.preventDefault(); setOpen(false); setActive(id);
      requestAnimationFrame(() => { target.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); target.focus({ preventScroll: true }); history.replaceState(null, "", `#brief-${id}`); });
    }}><span className="text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><span className="break-words">{title}</span></a></li>)}</ol></nav>
  </aside>;
}
