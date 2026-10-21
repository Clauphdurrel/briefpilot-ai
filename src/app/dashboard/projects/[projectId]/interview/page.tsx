import Link from "next/link";
import { notFound } from "next/navigation";

import { InterviewChat } from "@/components/brief/interview-chat";
import { GenerateBriefButton } from "@/components/brief/generate-brief-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/services/auth.service";
import { getInterview } from "@/server/services/interview.service";
import { listBriefs } from "@/server/services/brief.service";
import { getOwnedProject } from "@/server/services/project.service";
import { projectIdSchema } from "@/server/validators/project.schema";

export default async function InterviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser();
  const parsed = projectIdSchema.safeParse((await params).projectId);
  if (!parsed.success) notFound();
  const project = await getOwnedProject(user.id, parsed.data);
  if (!project) notFound();
  const initialState = await getInterview(user.id, project.id);
  const { readiness } = await listBriefs(user.id, project.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/projects/${project.id}`} className="text-sm text-muted-foreground hover:text-foreground">← Retour au projet</Link>
        <p className="mt-4 text-sm text-muted-foreground">Interview IA</p>
        <h1 className="break-words text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">{project.name}</h1>
      </div>
      <InterviewChat projectId={project.id} initialState={initialState} />
      <Card><CardHeader><CardTitle><h2>Passer au cahier des charges</h2></CardTitle></CardHeader><CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Le document sera préparé à partir des réponses enregistrées. Les versions précédentes resteront consultables.</p>
        <GenerateBriefButton projectId={project.id} readiness={readiness} label="Générer mon cahier des charges" />
        <Link href={`/dashboard/projects/${project.id}/briefs`} className="inline-block text-sm underline underline-offset-4">Voir les versions et actualiser les informations</Link>
      </CardContent></Card>
    </div>
  );
}
