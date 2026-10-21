export const pdfStyles = `
@page { size: A4; margin: 20mm 17mm 21mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; color: #253347; font: 10pt/1.6 Arial, sans-serif; overflow-wrap: anywhere; }
h1,h2,h3,h4 { color: #132739; line-height: 1.25; break-after: avoid; }
h1 { font-size: 32pt; letter-spacing: -1px; margin: 25mm 0 8mm; }
h2 { font-size: 18pt; border-bottom: 1px solid #c5d8db; padding-bottom: 4mm; margin: 9mm 0 5mm; }
h3 { font-size: 12pt; margin: 7mm 0 3mm; }
h4 { font-size: 10pt; margin: 4mm 0 2mm; }
p { margin: 2mm 0 4mm; orphans: 3; widows: 3; }
ul { padding-left: 5mm; margin: 3mm 0 5mm; }
li { margin: 1.5mm 0; orphans: 3; widows: 3; }
table { border-collapse: collapse; width: 100%; margin: 4mm 0 6mm; table-layout: fixed; font-size: 9pt; }
th,td { padding: 3mm; vertical-align: top; text-align: left; border-bottom: 1px solid #dbe4e8; overflow-wrap: anywhere; }
th { background: #eaf2f3; color: #193f47; }
thead { display: table-header-group; } tr { break-inside: avoid; }
.cover { height: 242mm; position: relative; border-top: 3mm solid #237c83; padding-top: 10mm; break-after: page; }
.brand { font-size: 12pt; font-weight: 700; letter-spacing: 3px; color: #237c83; }
.eyebrow { margin-top: 22mm; text-transform: uppercase; letter-spacing: 2px; font-size: 10pt; color: #526d7a; }
.cover h1 { margin-top: 8mm; }
.description { font-size: 13pt; color: #526577; margin-bottom: 12mm; }
.reference { background: #edf4f4; border-left: 1mm solid #237c83; padding: 5mm; margin: 8mm 0; }
.cover-note { position: absolute; bottom: 5mm; font-size: 9pt; color: #60727b; }
.toc { break-after: page; } .toc a { color: #193f47; text-decoration: none; } .toc li { margin: 3mm 0; }
.document-block { break-inside: avoid; }
.chapter { break-before: page; } .chapter-label { color: #237c83; font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; }
.conclusion { break-before: page; }
@media print { a { text-decoration: none; } }
`;
