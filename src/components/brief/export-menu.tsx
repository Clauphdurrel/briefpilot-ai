"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const maxBytes = 8 * 1024 * 1024;
class DownloadError extends Error {
  constructor(message: string, public expired = false) { super(message); }
}
export function ExportMenu({ projectId, briefId, backlogId }: { projectId: string; briefId?: string; backlogId?: string }) {
  const [pending, setPending] = useState(false), [notice, setNotice] = useState("");
  const [error, setError] = useState<DownloadError | null>(null);
  const running = useRef(false), mounted = useRef(true), controller = useRef<AbortController | null>(null);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    mounted.current = true;
    const allocated = urls.current;
    return () => { mounted.current = false; controller.current?.abort(); allocated.forEach((url) => URL.revokeObjectURL(url)); allocated.clear(); };
  }, []);
  if (!briefId && !backlogId) return <p className="text-xs text-muted-foreground">Aucun document disponible pour l’export.</p>;
  async function download(path: string, format: "md" | "pdf" = "md") {
    if (running.current) return;
    running.current = true; setPending(true); setError(null); setNotice("");
    controller.current = new AbortController();
    const timer = setTimeout(() => controller.current?.abort(), 60000);
    try {
      const response = await fetch(path, { cache: "no-store", ...(format === "pdf" ? { headers: { "Idempotency-Key": crypto.randomUUID() } } : {}), signal: controller.current.signal });
      if (!response.ok) {
        const message = response.status === 401 ? "Ta session a expiré. Reconnecte-toi pour télécharger ce document." : response.status === 404 ? "Cette version n’est plus disponible ou tu n’y as pas accès." : response.status === 429 ? "Le quota PDF est atteint ou un export est en cours. Consulte les offres ou réessaie plus tard." : response.status === 403 ? "Cette version nécessite un accès à l’historique complet. Consulte les offres." : response.status === 422 ? "Cette version ne peut pas être exportée. Vérifie les données du document avant de réessayer." : "Le téléchargement est momentanément indisponible. Réessaie.";
        throw new DownloadError(message, response.status === 401);
      }
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = /attachment; filename="([a-z0-9][a-z0-9-]{0,150}\.(?:md|pdf))"/.exec(disposition)?.[1];
      if (!filename || !filename.endsWith(`.${format}`) || !(format === "pdf" ? response.headers.get("content-type") === "application/pdf" : response.headers.get("content-type")?.startsWith("text/markdown"))) throw new DownloadError("Le fichier reçu est invalide. Réessaie depuis cette version du document.");
      const blob = await response.blob();
      if (!blob.size || blob.size > maxBytes) throw new DownloadError("Le fichier reçu est vide ou trop volumineux.");
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob); urls.current.add(url);
      const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 1000);
      setNotice(`Téléchargement lancé : ${filename}`);
    } catch (failure) { if (mounted.current) setError(failure instanceof DownloadError ? failure : new DownloadError("Connexion interrompue ou délai dépassé. Réessaie le téléchargement.")); }
    finally { clearTimeout(timer); running.current = false; if (mounted.current) setPending(false); }
  }
  const base = `/api/projects/${encodeURIComponent(projectId)}/exports`;
  return <div className="space-y-2" aria-label="Exports Markdown et PDF">
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" disabled={pending} aria-busy={pending}>{pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}{pending ? "Préparation du fichier…" : "Exporter"}</Button></DropdownMenuTrigger><DropdownMenuContent className="w-72 max-w-[calc(100vw-2rem)]" align="start"><DropdownMenuLabel>Version sélectionnée · Markdown</DropdownMenuLabel><DropdownMenuSeparator />
      {briefId && <DropdownMenuItem disabled={pending} onSelect={() => void download(`${base}/brief/${encodeURIComponent(briefId)}`)}>Télécharger le cahier des charges</DropdownMenuItem>}
      {backlogId && <><DropdownMenuItem disabled={pending} onSelect={() => void download(`${base}/backlog/${encodeURIComponent(backlogId)}`)}>Télécharger le backlog</DropdownMenuItem><DropdownMenuItem disabled={pending} onSelect={() => void download(`${base}/backlog/${encodeURIComponent(backlogId)}?format=codex-tasks`)}>Télécharger les tâches Codex</DropdownMenuItem></>}
      <DropdownMenuSeparator /><DropdownMenuLabel>Version sélectionnée · PDF</DropdownMenuLabel>
      {briefId && <><DropdownMenuItem disabled={pending} onSelect={() => void download(`${base}/pdf/brief/${encodeURIComponent(briefId)}`, "pdf")}>Télécharger le cahier des charges PDF</DropdownMenuItem><DropdownMenuItem disabled={pending} onSelect={() => void download(`${base}/pdf/project?briefId=${encodeURIComponent(briefId)}${backlogId ? `&backlogId=${encodeURIComponent(backlogId)}` : ""}`, "pdf")}>Télécharger le dossier projet PDF</DropdownMenuItem></>}
      {backlogId && <DropdownMenuItem disabled={pending} onSelect={() => void download(`${base}/pdf/backlog/${encodeURIComponent(backlogId)}`, "pdf")}>Télécharger le backlog PDF</DropdownMenuItem>}
    </DropdownMenuContent></DropdownMenu>
    {notice && <p role="status" className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{notice}</p>}
    {error && <div role="alert" className="space-y-1 text-xs text-destructive"><p>{error.message}</p><Link href="/pricing" className="underline">Voir les offres</Link>{error.expired && <Link href="/login" className="underline">Se reconnecter</Link>}</div>}
  </div>;
}
