// Standard text-token USD rates per million, verified 2026-10-21.
// Source: https://developers.openai.com/api/docs/pricing (Standard, not Batch/Flex/Priority).
// Never approximate an unknown model, tier, modality, or a future snapshot by prefix.
export const AI_PRICING_VERSION = "openai-standard-text-2026-10-21.v1";
export const AI_PRICING_SOURCE = "https://developers.openai.com/api/docs/pricing";
const mini = { input: 0.40, cachedInput: 0.10, output: 1.60 };
export const aiTextPricing: Readonly<Record<string, typeof mini>> = {
  "gpt-4.1-mini": mini,
  "gpt-4.1-mini-2025-04-14": mini,
};
export function estimateTextCost(model: string, usage: { input: number; cachedInput: number; output: number }, serviceTier: unknown): { amount: string; currency: "USD"; version: string } | null {
  const rate = Object.hasOwn(aiTextPricing, model) ? aiTextPricing[model] : undefined;
  if (!rate || serviceTier !== "default" || ![usage.input, usage.cachedInput, usage.output].every((count) => Number.isSafeInteger(count) && count >= 0) || usage.cachedInput > usage.input) return null;
  const amount = ((usage.input - usage.cachedInput) * rate.input + usage.cachedInput * rate.cachedInput + usage.output * rate.output) / 1_000_000;
  return { amount: amount.toFixed(12), currency: "USD", version: AI_PRICING_VERSION };
}
