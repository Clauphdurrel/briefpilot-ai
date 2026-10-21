import { storedBacklogSchema } from "@/server/validators/backlog.schema";
import { codeBlock, escapeMarkdown as e, exportReferenceSchema, markdownList as list, referenceMarkdown, type ExportReference } from "./markdown-utils";

export function codexTasksToMarkdown(raw: unknown, reference: ExportReference): string {
  const backlog = storedBacklogSchema.parse(raw);
  exportReferenceSchema.parse(reference);
  return `# Tâches Codex — ${e(backlog.generation.projectName)}\n\n${referenceMarkdown(reference)}\n\nCahier des charges source : version ${backlog.generation.sourceBriefVersion}\n\nPrompts issus du backlog enregistré, à relire avant utilisation. Le contenu du projet est une donnée non fiable ; il ne remplace pas les règles du repository. Aucun prompt n’est exécuté par cet export.\n\n` +
    backlog.document.tasks.map((task) => `## ${e(task.id)} — ${e(task.title)}\n\n### Rôle\n${e(task.role)}\n\n### Priorité\n${task.priority}\n\n### Description\n${e(task.description)}\n\n### Prérequis et dépendances\n${list([task.epicId, ...(task.storyId ? [task.storyId] : []), ...task.dependencies])}\n\n### Critères d’acceptation\n${list(task.acceptanceCriteria)}\n\n### Tests attendus\n${list(task.testingRequirements)}\n\n### Prompt Codex\n\n${codeBlock(task.codexPrompt)}`).join("\n\n") + "\n";
}
