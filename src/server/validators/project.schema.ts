import { z } from "zod";

import { projectTypes } from "@/config/projects";

export const createProjectSchema = z.object({
  name: z.string().trim()
    .min(2, "Le nom du projet doit contenir au moins 2 caractères.")
    .max(120, "Le nom du projet est trop long."),
  type: z.enum(projectTypes, { error: "Choisis un type de projet valide." }),
  description: z.string().trim()
    .max(2000, "La description est trop longue.").optional(),
});

export const projectIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
