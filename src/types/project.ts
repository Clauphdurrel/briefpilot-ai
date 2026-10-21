export type CreateProjectState = {
  message?: string;
  quotaExceeded?: boolean;
  errors?: Partial<Record<"name" | "type" | "description", string[]>>;
  values?: { name: string; type: string; description: string };
};
