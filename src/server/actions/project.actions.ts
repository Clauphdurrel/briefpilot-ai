"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { QuotaError } from "@/server/services/usage.service";
import { requireUser } from "@/server/services/auth.service";
import { createOwnedProject } from "@/server/services/project.service";
import { createProjectSchema } from "@/server/validators/project.schema";
import type { CreateProjectState } from "@/types/project";

export async function createProject(
  _previousState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const user = await requireUser();
  const raw = {
    name: formData.get("name"),
    type: formData.get("type"),
    description: formData.get("description") ?? "",
  };
  const values = {
    name: typeof raw.name === "string" ? raw.name : "",
    type: typeof raw.type === "string" ? raw.type : "WEBSITE",
    description: typeof raw.description === "string" ? raw.description : "",
  };
  const parsed = createProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { message: "Vérifie les champs du formulaire.", errors: parsed.error.flatten().fieldErrors, values };
  }

  let project;
  try {
    project = await createOwnedProject(user.id, parsed.data);
  } catch (error) {
    if (error instanceof QuotaError) return { message: error.message, values, quotaExceeded: true };
    return { message: "Impossible de créer le projet. Réessaie dans quelques instants.", values };
  }

  revalidatePath("/dashboard/projects");
  redirect(`/dashboard/projects/${project.id}`);
}

export async function archiveProject(_state: { message?: string }, data: FormData): Promise<{ message?: string }> {
  const user = await requireUser();
  const id = data.get("projectId"), archived = data.get("archived");
  if (typeof id !== "string" || !["true", "false"].includes(String(archived))) return { message: "Demande invalide." };
  try {
    const { setProjectArchived } = await import("@/server/services/project.service");
    await setProjectArchived(user.id, id, archived === "true");
  } catch (error) { return { message: error instanceof QuotaError ? error.message : "Impossible de modifier ce projet. Réessaie." }; }
  revalidatePath("/dashboard/projects"); revalidatePath(`/dashboard/projects/${id}`); revalidatePath("/dashboard/settings/subscription");
  return { message: archived === "true" ? "Projet archivé." : "Projet réactivé." };
}
