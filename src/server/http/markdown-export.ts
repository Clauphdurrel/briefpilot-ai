import "server-only";
import { z } from "zod";
import type { MarkdownExport } from "@/server/exports/export.service";
import { MAX_EXPORT_BYTES } from "@/server/exports/markdown/markdown-utils";

export function markdownResponse(result: MarkdownExport): Response {
  const filename = z.string().regex(/^[a-z0-9][a-z0-9-]{0,120}\.md$/).parse(result.filename);
  if (Buffer.byteLength(result.content, "utf8") > MAX_EXPORT_BYTES) throw new Error("Export exceeds response limit");
  return new Response(result.content, { headers: {
    "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
export function parseExportQuery(request: Request, kind: "brief" | "backlog") {
  const search = new URL(request.url).searchParams;
  const schema = kind === "brief" ? z.strictObject({}) : z.strictObject({ format: z.enum(["backlog", "codex-tasks"]).optional() });
  // Duplicate parameters must not silently choose a different export mode.
  if ([...search.keys()].some((key) => search.getAll(key).length !== 1)) throw new z.ZodError([]);
  return schema.parse(Object.fromEntries(search)) as { format?: "backlog" | "codex-tasks" };
}
