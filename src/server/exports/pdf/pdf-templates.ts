import { pdfStyles } from "./pdf-styles";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
// Only the controlled Markdown emitted by our JSON converters is supported.
// Client HTML, links, images and Markdown extensions never become active markup.
function plain(value: string): string {
  return escapeHtml(value.replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\\([\\`*_{}\[\]()#+.!|])/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
}
function cells(line: string): string[] {
  return line.slice(1, -1).split(/(?<!\\)\|/).map((cell) => cell.trim());
}
export function markdownBlocks(markdown: string): string {
  const lines = markdown.split("\n"), result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.startsWith("# ")) continue;
    const heading = /^(#{2,4}) (.*)$/.exec(line);
    if (heading) { result.push(`<h${heading[1].length}>${plain(heading[2])}</h${heading[1].length}>`); continue; }
    if (line.startsWith("| ") && lines[i + 1]?.startsWith("| ---")) {
      const headers = cells(line); i++;
      const rows: string[] = [];
      while (lines[i + 1]?.startsWith("| ")) rows.push(`<tr>${cells(lines[++i]).map((cell) => `<td>${plain(cell)}</td>`).join("")}</tr>`);
      result.push(`<table><thead><tr>${headers.map((cell) => `<th>${plain(cell)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`); continue;
    }
    if (line.startsWith("- ")) {
      const items = [line.slice(2)];
      while (lines[i + 1]?.startsWith("- ")) items.push(lines[++i].slice(2));
      result.push(`<ul>${items.map((item) => `<li>${plain(item)}</li>`).join("")}</ul>`); continue;
    }
    result.push(`<p>${plain(line)}</p>`);
  }
  return result.join("\n").replace(/(<h3>[\s\S]*?)(?=<h[23]>|$)/g, '<div class="document-block">$1</div>');
}
export type PdfChapter = { title: string; markdown: string };
export type PdfDocument = { title: string; projectName: string; description: string; reference: string; date: string; chapters: PdfChapter[]; conclusion?: string };
export function documentHtml(doc: PdfDocument): string {
  const toc: string[] = [], body: string[] = [];
  doc.chapters.forEach((chapter, index) => {
    const chapterId = `chapter-${index}`;
    toc.push(`<li><a href="#${chapterId}">${escapeHtml(chapter.title)}</a><ul>`);
    let count = 0;
    const html = markdownBlocks(chapter.markdown).replace(/<h2>(.*?)<\/h2>/g, (_, title: string) => {
      const id = `${chapterId}-section-${count++}`;
      toc.push(`<li><a href="#${id}">${title}</a></li>`);
      return `<h2 id="${id}">${title}</h2>`;
    });
    toc.push("</ul></li>");
    body.push(`<article class="chapter" id="${chapterId}"><p class="chapter-label">${escapeHtml(chapter.title)}</p>${html}</article>`);
  });
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(doc.title)} — ${escapeHtml(doc.projectName)}</title><style>${pdfStyles}</style></head><body>
<section class="cover"><div class="brand">BRIEFPILOT AI</div><div class="eyebrow">${escapeHtml(doc.title)}</div><h1>${escapeHtml(doc.projectName)}</h1><p class="description">${escapeHtml(doc.description.length > 350 ? `${doc.description.slice(0, 347)}…` : doc.description)}</p><div class="reference">${escapeHtml(doc.reference)}<br>Date de référence : ${escapeHtml(new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(doc.date)))}</div><p>Document de travail · Validation client requise</p><p class="cover-note">Préparé avec BriefPilot AI<br>Les hypothèses et informations manquantes restent à confirmer.</p></section>
<nav class="toc"><h2>Sommaire</h2><p>Liens vers les sections du document.</p><ul>${toc.join("")}${doc.conclusion ? '<li><a href="#conclusion">Conclusion documentaire</a></li>' : ""}</ul></nav>${body.join("")}${doc.conclusion ? `<section class="conclusion" id="conclusion"><h2>Conclusion documentaire</h2><p>${escapeHtml(doc.conclusion)}</p></section>` : ""}</body></html>`;
}
