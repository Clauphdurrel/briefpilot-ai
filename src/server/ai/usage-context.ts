import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { startUsage, commitUsage, withUsage, type UsageTicket } from "@/server/services/usage.service";
const storage = new AsyncLocalStorage<UsageTicket>();
export const currentUsage = () => storage.getStore();
export function runMetered<T>(ticket: UsageTicket, action: () => Promise<T>) { return storage.run(ticket, () => withUsage(ticket, action)); }
export async function meterProvider<T>(action: () => Promise<T>): Promise<T> {
  const ticket = currentUsage();
  if (!ticket) return action();
  await startUsage(ticket);
  // Once dispatch is possible, failed/unknown provider outcomes count conservatively.
  try { return await action(); } finally { await commitUsage(ticket); }
}
