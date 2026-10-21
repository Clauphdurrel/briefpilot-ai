import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InterviewState } from "@/server/validators/interview-agent.schema";

function Information({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <section className="space-y-2"><h3 className="text-sm font-medium">{title}</h3>{items.length ? <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">{items.map((item, index) => <li className="break-words [overflow-wrap:anywhere]" key={index}>{item}</li>)}</ul> : <p className="text-xs leading-relaxed text-muted-foreground">{empty}</p>}</section>;
}
export function InterviewSummary({ state }: { state: InterviewState }) {
  const analysis = state.analysis;
  return <Card><CardHeader><CardTitle><h2>Ce que nous avons compris</h2></CardTitle></CardHeader><CardContent className="space-y-5">
    <p className="break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{analysis?.summary ?? "Ton résumé se construira au fil de la conversation."}</p>
    <Information title="Informations collectées" items={analysis?.knownInformation ?? []} empty="Aucune information collectée pour l’instant." />
    <p className="text-xs text-muted-foreground">Synthèse de l’assistant à relire : précise ou corrige une information directement dans la conversation.</p>
    <Information title="Hypothèses à confirmer" items={analysis?.assumptions ?? []} empty="Aucune hypothèse signalée à ce stade." />
    <Information title="Informations à préciser" items={state.missingInformation} empty={state.completionScore === null ? "L’analyse apparaîtra après le premier échange." : "Aucun manque signalé par l’assistant à ce stade."} />
    {analysis?.nextQuestion && <section className="rounded-lg bg-muted/60 p-3 text-sm"><h3 className="mb-2 font-medium">Prochaine clarification {analysis.nextQuestion.priority === "high" ? "prioritaire" : "utile"}</h3><p className="break-words [overflow-wrap:anywhere]">{analysis.nextQuestion.question}</p>{analysis.nextQuestion.helpText && <p className="mt-2 text-xs text-muted-foreground">{analysis.nextQuestion.helpText}</p>}</section>}
  </CardContent></Card>;
}
