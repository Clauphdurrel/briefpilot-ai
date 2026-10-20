"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { projectTypes, projectTypeLabels } from "@/config/projects";
import { createProject } from "@/server/actions/project.actions";
import type { CreateProjectState } from "@/types/project";

const initialState: CreateProjectState = {};

export function CreateProjectForm() {
  const [state, action, pending] = useActionState(createProject, initialState);

  return (
    <Card>
      <CardHeader><CardTitle><h2>Nouveau projet</h2></CardTitle></CardHeader>
      <CardContent>
        <form action={action} aria-busy={pending} className="space-y-5">
          {state.message && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
          <fieldset disabled={pending} className="min-w-0 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du projet</Label>
              <Input id="name" name="name" placeholder="Ex : Site immobilier premium"
                required minLength={2} maxLength={120} defaultValue={state.values?.name}
                aria-invalid={!!state.errors?.name} aria-describedby={state.errors?.name ? "name-error" : undefined} />
              {state.errors?.name && <p id="name-error" className="text-sm text-destructive">{state.errors.name[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type de projet</Label>
              <select id="type" name="type" required defaultValue={state.values?.type ?? "WEBSITE"}
                aria-invalid={!!state.errors?.type} aria-describedby={state.errors?.type ? "type-error" : undefined}
                className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {projectTypes.map((type) => <option key={type} value={type}>{projectTypeLabels[type]}</option>)}
              </select>
              {state.errors?.type && <p id="type-error" className="text-sm text-destructive">{state.errors.type[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description courte (facultative)</Label>
              <Textarea id="description" name="description" rows={5} maxLength={2000}
                placeholder="Décris rapidement ce que le client veut créer…" defaultValue={state.values?.description}
                aria-invalid={!!state.errors?.description} aria-describedby={state.errors?.description ? "description-error" : undefined} />
              {state.errors?.description && <p id="description-error" className="text-sm text-destructive">{state.errors.description[0]}</p>}
            </div>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Création en cours…" : "Créer le projet"}
            </Button>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
