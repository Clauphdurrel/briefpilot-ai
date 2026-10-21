"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contentImportanceLabels, contentStatusLabels } from "@/lib/interview-presentation";
import { interviewContentSchema, type InterviewContent } from "@/server/validators/interview-content.schema";

export function ProjectContentChecklist({ items, disabled, onSelect }: { items: InterviewContent[]; disabled: boolean; onSelect: (item: InterviewContent) => void }) {
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InterviewContent | null>(null);
  return <Card><CardHeader><CardTitle><h2>Contenus du projet</h2></CardTitle></CardHeader><CardContent className="space-y-4 text-sm">
    <p className="text-xs leading-relaxed text-muted-foreground">Identifie seulement les contenus utiles au projet : textes, identité visuelle, documents ou liens. Aucun fichier n’est envoyé ici.</p>
    {items.length ? <ul className="space-y-3" aria-label="Contenus déclarés">{items.map((item) => <li key={item.name} className="space-y-2 rounded-lg border p-3"><p className="break-words font-medium [overflow-wrap:anywhere]">{item.name}</p><div className="flex flex-wrap gap-1"><Badge variant="outline">{contentStatusLabels[item.status]}</Badge><Badge variant="secondary">{contentImportanceLabels[item.importance]}</Badge></div><p className="whitespace-pre-wrap break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.description || "Sans description."}</p>{item.url && <a className="block break-all text-xs underline" href={item.url} target="_blank" rel="noopener noreferrer">Ouvrir le lien fourni</a>}<p className="text-xs text-muted-foreground">Statut déclaré dans la conversation.</p><Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => { setEditing(item); setOpen(true); setError(""); }}>Actualiser ce contenu</Button></li>)}</ul> : <p className="text-xs text-muted-foreground">Aucun contenu déclaré pour l’instant. Nous ne présumons pas des éléments nécessaires.</p>}
    <Button type="button" variant="outline" size="sm" className="max-w-full" disabled={disabled} onClick={() => { setEditing(null); setOpen(!open); setError(""); }} aria-expanded={open} aria-controls="content-form"><Plus className="size-4" aria-hidden="true" />Identifier un contenu</Button>
    {open && <form key={editing?.name ?? "new"} id="content-form" className="space-y-3" onSubmit={(event) => {
      event.preventDefault(); const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
      const parsed = interviewContentSchema.safeParse(values);
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Vérifie les champs du contenu."); return; }
      onSelect(parsed.data); setError(""); setOpen(false); setEditing(null); form.reset();
    }}><div className="space-y-1"><Label htmlFor="content-name">Contenu demandé ou proposé</Label><Input id="content-name" name="name" defaultValue={editing?.name} required maxLength={120} placeholder="Ex. Textes de présentation" disabled={disabled} /></div>
      <div className="space-y-1"><Label htmlFor="content-status">Statut déclaré</Label><select id="content-status" name="status" required defaultValue={editing?.status ?? ""} disabled={disabled} className="h-9 w-full rounded-md border bg-background px-2"><option value="" disabled>Choisir un statut</option>{Object.entries(contentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="content-importance">Importance</Label><select id="content-importance" name="importance" defaultValue={editing?.importance ?? "medium"} disabled={disabled} className="h-9 w-full rounded-md border bg-background px-2">{Object.entries(contentImportanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="space-y-1"><Label htmlFor="content-description">Description</Label><Textarea id="content-description" name="description" defaultValue={editing?.description} maxLength={500} rows={3} disabled={disabled} /></div>
      <div className="space-y-1"><Label htmlFor="content-url">Lien utile (facultatif)</Label><Input id="content-url" type="url" name="url" defaultValue={editing?.url} maxLength={1000} placeholder="https://…" disabled={disabled} /></div>
      <p className="text-xs text-muted-foreground">N’ajoute aucun mot de passe ni lien contenant des identifiants. La fiche sera préparée avec ta prochaine réponse ; clique sur Envoyer pour l’enregistrer.</p><Button type="submit" disabled={disabled} size="sm">Préparer cette fiche</Button>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </form>}
  </CardContent></Card>;
}
