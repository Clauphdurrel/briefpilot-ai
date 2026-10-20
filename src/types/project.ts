export type CreateProjectState = {
  message?: string;
  errors?: Partial<Record<"name" | "type" | "description", string[]>>;
  values?: { name: string; type: string; description: string };
};
