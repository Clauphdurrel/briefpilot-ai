import "server-only";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import OpenAI from "openai";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { estimateTextCost } from "@/config/ai-pricing";
import { currentUsage } from "@/server/ai/usage-context";
import { currentOperation } from "./context";
import { logEvent } from "./logger";

export const aiMonitoringEnabled = () => process.env.OBSERVABILITY_ENABLED === "true" && process.env.AI_MONITORING_ENABLED === "true";
const agentNames: Record<string, string> = { interview_turn: "InterviewClientAgent", project_brief: "BriefGeneratorAgent", project_backlog: "BacklogGeneratorAgent" };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const identifier = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null;
const modelName = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(value) ? value : null;
const tokenCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2147483647;
function measuredUsage(value: unknown) {
  const usage = record(value), details = record(usage.input_tokens_details);
  const input = usage.input_tokens, output = usage.output_tokens, total = usage.total_tokens, cachedInput = details.cached_tokens;
  if (!tokenCount(input) || !tokenCount(output) || !tokenCount(total) || total !== input + output) return null;
  return { input, output, total, cachedInput: tokenCount(cachedInput) && cachedInput <= input ? cachedInput : null, cacheWrites: details.cache_write_tokens };
}
function failureCode(error: unknown) {
  if (error instanceof OpenAI.APIConnectionTimeoutError) return "AI_TIMEOUT";
  if (error instanceof OpenAI.RateLimitError) return "AI_QUOTA";
  if (error instanceof OpenAI.APIConnectionError) return "AI_NETWORK";
  if (error instanceof SyntaxError || error instanceof ZodError) return "AI_INVALID_OUTPUT";
  return "AI_UNAVAILABLE";
}
function outcome(response: Record<string, unknown>) {
  if (Array.isArray(response.output) && response.output.some((item) => Array.isArray(record(item).content) && (record(item).content as unknown[]).some((part) => record(part).type === "refusal"))) return "AI_REFUSAL";
  return response.status === "completed" ? null : "AI_INCOMPLETE";
}
function safeEvent(event: string, fields: Record<string, unknown>) {
  try { logEvent(event, fields); } catch { /* Monitoring cannot change the provider result. */ }
}
async function persist(data: Parameters<typeof prisma.aIUsageLog.create>[0]["data"]) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Bound telemetry latency; a stalled database must not stall generation indefinitely.
    await Promise.race([prisma.aIUsageLog.create({ data }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("telemetry timeout")), 1000); })]);
  } catch {
    safeEvent("ai_monitoring_unavailable", { status: "error", errorCode: "AI_MONITORING_UNAVAILABLE" });
  } finally { if (timer) clearTimeout(timer); }
}

/** Wrap exactly one SDK parse invocation. Never pass its input/output/error text to telemetry. */
export async function monitorAI<T>(request: unknown, action: () => Promise<T>): Promise<T> {
  if (!aiMonitoringEnabled()) return action();
  const started = performance.now(), attemptId = randomUUID();
  const context = currentOperation(), ticket = currentUsage();
  const params = record(request), format = record(record(params.text).format);
  const agent = typeof format.name === "string" && Object.hasOwn(agentNames, format.name) ? agentNames[format.name] : "UnknownAgent";
  const base = { attemptId, requestId: identifier(context?.requestId), operationId: identifier(context?.operationId),
    userId: identifier(ticket?.userId ?? context?.userId), projectId: identifier(context?.projectId), agent };
  let response: Record<string, unknown> = {}, errorCode: string | null = null;
  try {
    const result = await action(); response = record(result); errorCode = outcome(response); return result;
  } catch (error) { errorCode = failureCode(error); throw error; }
  finally {
    // All telemetry work is best-effort, including serialization, pricing and persistence.
    try {
      const usage = measuredUsage(response.usage);
      const model = response.model === undefined ? modelName(params.model) ?? "unknown" : modelName(response.model) ?? "unknown";
      const cost = usage && usage.cachedInput !== null && !usage.cacheWrites ? estimateTextCost(model, { ...usage, cachedInput: usage.cachedInput }, response.service_tier) : null;
      const data = { ...base, model, durationMs: Math.min(2147483647, Math.max(0, Math.round(performance.now() - started))),
        inputTokens: usage?.input ?? null, cachedInputTokens: usage?.cachedInput ?? null, outputTokens: usage?.output ?? null, totalTokens: usage?.total ?? null,
        estimatedCost: cost?.amount ?? null, currency: "USD", pricingVersion: cost?.version ?? null,
        status: errorCode ? "ERROR" : "SUCCESS", errorCode, usageStatus: usage ? usage.cachedInput === null ? "PARTIAL" : "KNOWN" : "UNKNOWN" };
      safeEvent("ai_call_completed", { attemptId, requestId: base.requestId, operationId: base.operationId, agentName: agent, model, durationMs: data.durationMs, status: data.status, errorCode, usageStatus: data.usageStatus,
        inputTokens: data.inputTokens, cachedInputTokens: data.cachedInputTokens, outputTokens: data.outputTokens, totalTokens: data.totalTokens,
        estimatedCost: data.estimatedCost === null ? null : Number(data.estimatedCost), currency: data.currency, pricingVersion: data.pricingVersion });
      await persist(data);
    } catch { safeEvent("ai_monitoring_unavailable", { status: "error", errorCode: "AI_MONITORING_UNAVAILABLE" }); }
  }
}
