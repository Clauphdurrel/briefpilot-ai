import Link from "next/link";
import { notFound } from "next/navigation";

import { InterviewChat } from "@/components/brief/interview-chat";
import { requireUser } from "@/server/services/auth.service";
import { getInterview } from "@/server/services/interview.service";
import { getOwnedProject } from "@/server/services/project.service";
import { projectIdSchema } from "@/server/validators/project.schema";

export default async function InterviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser();
  const parsed = projectIdSchema.safeParse((await params).projectId);
  if (!parsed.success) notFound();
  const project = await getOwnedProject(user.id, parsed.data);
  if (!project) notFound();
  const initialState = await getInterview(user.id, project.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/projects/${project.id}`} className="text-sm text-muted-foreground hover:text-foreground">← Retour au projet</Link>
        <p className="mt-4 text-sm text-muted-foreground">Interview IA</p>
        <h1 className="break-words text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">{project.name}</h1>
      </div>
      <InterviewChat projectId={project.id} initialState={initialState} />
    </div>
  );
}
