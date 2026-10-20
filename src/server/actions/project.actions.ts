"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  } catch {
    return { message: "Impossible de créer le projet. Réessaie dans quelques instants.", values };
  }

  revalidatePath("/dashboard/projects");
  redirect(`/dashboard/projects/${project.id}`);
}
