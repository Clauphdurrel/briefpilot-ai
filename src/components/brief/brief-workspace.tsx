"use client";

import { useState, type ReactNode } from "react";
import { PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BriefWorkspace({ toc, insights, children }: { toc: ReactNode; insights: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="grid items-start gap-5 xl:grid-cols-[180px_minmax(0,1fr)_260px]">
    {toc}
    <div className="min-w-0"><div className="mb-4 xl:hidden"><Button variant="outline" onClick={() => { setOpen(!open); if (!open) requestAnimationFrame(() => document.getElementById("document-insights")?.focus()); }} aria-expanded={open} aria-controls="document-insights"><PanelRight aria-hidden="true" className="size-4" />Analyse et actions</Button></div>{children}</div>
    <aside id="document-insights" tabIndex={-1} className={`min-w-0 space-y-6 rounded-xl border bg-background p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring xl:block ${open ? "block" : "hidden"}`} aria-label="Analyse et actions du document"><Button variant="ghost" size="sm" className="xl:hidden" onClick={() => { setOpen(false); document.getElementById("document-start")?.focus(); }}>Retour au document</Button>{insights}</aside>
  </div>;
}
