import { z } from "zod";

import { generatedBriefSchema, type GeneratedBrief } from "./brief.schema";
import { projectTypeSchema } from "./interview.schema";
import { projectIdSchema } from "./project.schema";

const text = z.string().trim().min(1).max(2000);
const id = z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_-]{0,79}$/);
const refs = z.array(id).max(30);
const criteria = z.array(text).min(1).max(15);
export const backlogPrioritySchema = z.enum(["P0", "P1", "P2"]);
export const phaseSchema = z.enum(["Foundation", "MVP", "V1", "Future"]);
export const taskRoleSchema = z.enum(["architect", "backend", "frontend", "ai-engineer", "qa", "devops", "security"]);
export const estimationSchema = z.strictObject({
  complexity: z.enum(["XS", "S", "M", "L", "XL"]),
  estimatedEffort: z.strictObject({ minHours: z.number().min(0.5).max(80), maxHours: z.number().min(0.5).max(80) }).nullable(),
  rationale: text,
});
const basis = {
  basis: z.enum(["confirmed", "assumed", "recommended"]),
  sourceFeatureIds: z.array(z.string().min(1).max(100)).max(20),
};
export const epicSchema = z.strictObject({
  id, title: text, description: text, priority: backlogPrioritySchema, phase: phaseSchema,
  dependencies: refs, ...basis,
});
export const userStorySchema = z.strictObject({
  id, epicId: id, title: text, description: text, userRole: text, businessValue: text,
  priority: backlogPrioritySchema, acceptanceCriteria: criteria, dependencies: refs, ...basis,
});
export const technicalTaskSchema = z.strictObject({
  id, storyId: id.nullable(), epicId: id, title: text, description: text, role: taskRoleSchema,
  priority: backlogPrioritySchema, estimation: estimationSchema, dependencies: refs,
  acceptanceCriteria: criteria, testingRequirements: criteria,
  suggestedFiles: z.array(z.string().min(1).max(200)).max(15),
  constraints: z.array(text).max(15), risks: z.array(text).max(15),
  codexPrompt: z.string().min(1).max(16000), ...basis,
});
export const dependencySchema = z.strictObject({ from: id, to: id, kind: z.enum(["requires", "parent"]) });
export const backlogSchema = z.strictObject({
  summary: z.strictObject({ projectName: z.string().min(1).max(120), projectType: projectTypeSchema,
    objective: text, scope: text, technicalAssumptions: z.array(text).max(30), missingInformation: z.array(text).max(40) }),
  phases: z.array(z.strictObject({ name: phaseSchema, objective: text })).length(4),
  epics: z.array(epicSchema).min(1).max(20),
  stories: z.array(userStorySchema).max(50),
  tasks: z.array(technicalTaskSchema).min(1).max(80),
});
export const backlogAgentInputSchema = z.strictObject({
  project: z.strictObject({ name: z.string().min(1).max(120), type: projectTypeSchema, description: z.string().max(2000).nullable() }),
  brief: generatedBriefSchema,
  confirmedTechnicalInformation: z.array(text).max(40), constraints: z.array(text).max(40),
  language: z.enum(["fr", "en"]),
});
export const generateBacklogRequestSchema = z.strictObject({
  requestId: z.uuid(), sourceBriefId: projectIdSchema,
  allowDraft: z.boolean().default(false), regenerate: z.boolean().default(false), language: z.enum(["fr", "en"]).default("fr"),
});
export const storedBacklogSchema = z.strictObject({
  schemaVersion: z.literal("backlog.v1"), document: backlogSchema,
  generation: z.strictObject({ model: z.string().min(1), language: z.enum(["fr", "en"]), generatedAt: z.iso.datetime(), projectName: z.string().min(1).max(120), sourceBriefVersion: z.number().int().positive() }),
});
export type Backlog = z.infer<typeof backlogSchema>;
export type Phase = z.infer<typeof phaseSchema>;
export type Epic = z.infer<typeof epicSchema>;
export type UserStory = z.infer<typeof userStorySchema>;
export type TechnicalTask = z.infer<typeof technicalTaskSchema>;
export type Dependency = z.infer<typeof dependencySchema>;
export type Estimation = z.infer<typeof estimationSchema>;
export type BacklogAgentInput = z.infer<typeof backlogAgentInputSchema>;
export type GenerateBacklogRequest = z.infer<typeof generateBacklogRequestSchema>;

export function buildDependencyGraph(backlog: Backlog): Dependency[] {
  return [
    ...backlog.epics.flatMap((node) => node.dependencies.map((to) => ({ from: node.id, to, kind: "requires" as const }))),
    ...backlog.stories.flatMap((node) => [{ from: node.id, to: node.epicId, kind: "parent" as const }, ...node.dependencies.map((to) => ({ from: node.id, to, kind: "requires" as const }))]),
    ...backlog.tasks.flatMap((node) => [{ from: node.id, to: node.epicId, kind: "parent" as const }, ...(node.storyId ? [{ from: node.id, to: node.storyId, kind: "parent" as const }] : []), ...node.dependencies.map((to) => ({ from: node.id, to, kind: "requires" as const }))]),
  ];
}

// Deterministic graph validation is kept outside the JSON schema sent to OpenAI.
export function validateBacklog(backlog: Backlog, brief: GeneratedBrief): void {
  const fail = (message: string): never => { throw new Error(message); };
  const phases = ["Foundation", "MVP", "V1", "Future"];
  if (new Set(backlog.phases.map((phase) => phase.name)).size !== 4) fail("Les quatre phases doivent être distinctes.");
  const nodes = [...backlog.epics, ...backlog.stories, ...backlog.tasks];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (byId.size !== nodes.length) fail("Identifiants dupliqués.");
  const epics = new Map(backlog.epics.map((node) => [node.id, node]));
  const stories = new Map(backlog.stories.map((node) => [node.id, node]));
  const features = new Map(brief.features.map((feature) => [feature.id, feature]));
  const phaseOf = (node: typeof nodes[number]) => "phase" in node ? node.phase : epics.get(node.epicId)?.phase;
  for (const node of nodes) {
    if (new Set(node.dependencies).size !== node.dependencies.length || new Set(node.sourceFeatureIds).size !== node.sourceFeatureIds.length) fail("Références dupliquées.");
    if ("epicId" in node && !epics.has(node.epicId)) fail("Épic introuvable.");
    if ("storyId" in node && node.storyId && stories.get(node.storyId)?.epicId !== node.epicId) fail("Story absente ou rattachée à un autre épic.");
    for (const featureId of node.sourceFeatureIds) {
      const feature = features.get(featureId);
      if (!feature || feature.priority === "WONT") fail("Fonctionnalité source absente ou exclue.");
      if (node.basis === "confirmed" && feature?.status !== "confirmed") fail("Une recommandation ne peut pas devenir une exigence confirmée.");
    }
    if (node.basis === "confirmed" && !node.sourceFeatureIds.length) fail("Une exigence confirmée doit être sourcée.");
    if (!node.sourceFeatureIds.length && (node.basis !== "recommended" || phaseOf(node) !== "Foundation")) fail("Une tâche sans source doit rester une recommandation de fondation technique.");
    if (node.basis !== "confirmed" && node.sourceFeatureIds.length && (phaseOf(node) === "MVP" || node.priority === "P0")) fail("Les besoins non confirmés doivent rester hors du MVP obligatoire.");
    if ("estimation" in node) {
      const effort = node.estimation.estimatedEffort;
      if (effort && effort.minHours > effort.maxHours) fail("Fourchette d’effort inversée.");
      if (node.suggestedFiles.some((file) => file.startsWith("/") || file.includes("..") || file.includes(":") || file.includes("\\"))) fail("Les fichiers suggérés doivent être des chemins relatifs plausibles.");
    }
  }
  const graph = buildDependencyGraph(backlog);
  const edges = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of graph) {
    const target = byId.get(edge.to), source = byId.get(edge.from)!;
    if (!target || edge.from === edge.to) fail("Dépendance inconnue ou vers soi-même.");
    if (phases.indexOf(phaseOf(target!)!) > phases.indexOf(phaseOf(source)!)) fail("Une dépendance ne peut pas appartenir à une phase ultérieure.");
    edges.get(edge.from)!.push(edge.to);
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(nodeId: string) {
    if (visiting.has(nodeId)) fail("Dépendances circulaires.");
    if (visited.has(nodeId)) return;
    visiting.add(nodeId); edges.get(nodeId)!.forEach(visit); visiting.delete(nodeId); visited.add(nodeId);
  }
  nodes.forEach((node) => visit(node.id));
  const covered = new Set(backlog.tasks.filter((task) => task.basis === "confirmed").flatMap((task) => task.sourceFeatureIds));
  if (brief.features.some((feature) => feature.status === "confirmed" && feature.priority === "MUST" && !covered.has(feature.id))) fail("Une fonctionnalité MUST confirmée est absente des tâches du backlog.");
}
