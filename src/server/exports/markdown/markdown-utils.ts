import { z } from "zod";
import { escapeMarkdown } from "@/server/formatters/brief-markdown";

export { escapeMarkdown };
export const exportReferenceSchema = z.strictObject({
  version: z.number().int().positive(), createdAt: z.iso.datetime(),
});
export type ExportReference = z.infer<typeof exportReferenceSchema>;
export const MAX_EXPORT_BYTES = 8 * 1024 * 1024;
export function exportFilename(projectName: string, kind: "brief" | "backlog" | "codex-tasks", version: number): string {
  z.number().int().positive().parse(version);
  const slug = projectName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").slice(0, 80).replace(/^-+|-+$/g, "") || "projet";
  return `${slug}-${kind}-v${version}.md`;
}
export function markdownTable(headers: string[], rows: (string | number)[][]): string {
  return [headers, headers.map(() => "---"), ...rows].map((row) => `| ${row.map((cell) => escapeMarkdown(String(cell))).join(" | ")} |`).join("\n");
}
export function markdownList(items: string[]): string {
  return items.length ? items.map((item) => `- ${escapeMarkdown(item)}`).join("\n") : "Aucun élément renseigné.";
}
export function codeBlock(text: string): string {
  const width = Math.max(3, ...[...text.matchAll(/`+/g)].map((match) => match[0].length + 1));
  const fence = "`".repeat(width);
  return `${fence}text\n${text}${text.endsWith("\n") ? "" : "\n"}${fence}`;
}
export function referenceMarkdown(reference: ExportReference): string {
  const parsed = exportReferenceSchema.parse(reference);
  return `Version : ${parsed.version}\n\nDate de référence (UTC) : ${escapeMarkdown(parsed.createdAt)}`;
}
