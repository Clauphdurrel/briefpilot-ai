import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { categoryLabels } from "@/lib/interview-presentation";
import type { InterviewState } from "@/server/validators/interview-agent.schema";

export function InterviewProgress({ state }: { state: InterviewState }) {
  const coverage = state.analysis?.coverage ?? [];
  return <Card><CardHeader><CardTitle><h2>Progression du cadrage</h2></CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="flex items-baseline gap-2"><p className="text-3xl font-bold tracking-tight">{state.completionScore === null ? "À évaluer" : `${state.completionScore} %`}</p><span className="text-xs text-muted-foreground">de couverture estimée</span></div>
    {state.completionScore !== null && <progress aria-label="Complétude du brief" className="h-2 w-full accent-primary" value={state.completionScore} max={100} />}
    <p className="text-xs leading-relaxed text-muted-foreground">Score issu de l’analyse enregistrée. Il aide à repérer les sujets à préciser et ne garantit pas un cahier des charges exhaustif.</p>
    {coverage.length ? <ul className="space-y-2 text-xs" aria-label="Catégories du cadrage">{coverage.map((item) => {
      const Icon = item.status === "confirmed" ? CheckCircle2 : item.status === "partial" ? CircleDot : Circle;
      return <li key={item.category} className="flex items-start gap-2"><Icon aria-hidden="true" className={`mt-0.5 size-3.5 shrink-0 ${item.status === "confirmed" ? "text-primary" : "text-muted-foreground"}`} /><span className="min-w-0 flex-1">{categoryLabels[item.category] ?? item.category}</span><span className="text-muted-foreground">{item.status === "confirmed" ? "Exploré" : item.status === "partial" ? "À compléter" : "À explorer"}</span></li>;
    })}</ul> : <p className="text-sm text-muted-foreground">Les catégories apparaîtront après le premier échange.</p>}
    <p className="text-xs text-muted-foreground">Un sujet ne s’applique pas ? Indique-le dans ta réponse pour que l’assistant en tienne compte.</p>
  </CardContent></Card>;
}
