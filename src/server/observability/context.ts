import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
export type OperationContext = { requestId: string; operationId?: string; module?: string; userId?: string; projectId?: string; reportedErrors?: WeakSet<object> };
const storage = new AsyncLocalStorage<OperationContext>();
export const currentOperation = () => storage.getStore();
// Generate correlation identifiers locally; never copy a user-controlled header.
export function withOperation<T>(fields: Omit<Partial<OperationContext>, "requestId">, action: () => T): T {
  const parent = currentOperation();
  return storage.run({ requestId: parent?.requestId ?? randomUUID(), ...parent, ...fields,
    operationId: fields.operationId ?? parent?.operationId ?? randomUUID(), reportedErrors: parent?.reportedErrors ?? new WeakSet() }, action);
}
