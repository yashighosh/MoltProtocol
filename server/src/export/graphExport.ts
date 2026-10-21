export type ExportNode = { id: string; name: string; kind: string; directory: string };
export type ExportEdge = { from: string; to: string; relationship: string; resolution: string };

export function buildGraphSvg(nodes: ExportNode[], edges: ExportEdge[]): string {
  const columns = new Map<string, ExportNode[]>();
  for (const node of nodes) {
    const key = node.directory || "(root)";
    columns.set(key, [...(columns.get(key) ?? []), node]);
  }
  const positions = new Map<string, { x: number; y: number }>();
  let columnIndex = 0;
  for (const group of columns.values()) {
    group.forEach((node, row) => positions.set(node.id, { x: 40 + columnIndex * 220, y: 70 + row * 64 }));
    columnIndex += 1;
  }
  const width = Math.max(640, 80 + columnIndex * 220);
  const height = Math.max(360, 120 + Math.max(0, ...[...columns.values()].map((group) => group.length)) * 64);

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edgeMarkup = edges.map((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return "";
    const dash = edge.resolution === "confirmed" ? "" : ' stroke-dasharray="5 4"';
    return `<line x1="${from.x + 150}" y1="${from.y + 16}" x2="${to.x}" y2="${to.y + 16}" stroke="${edge.resolution === "confirmed" ? "#263B50" : "#B18B42"}" stroke-width="1.4"${dash} />`;
  }).join("");

  const nodeMarkup = nodes.map((node) => {
    const at = positions.get(node.id)!;
    const label = escapeXml(node.name.split("/").pop() ?? node.name);
    return `<g><rect x="${at.x}" y="${at.y}" width="160" height="32" rx="2" fill="#F0E9DC" stroke="#292721" /><text x="${at.x + 8}" y="${at.y + 20}" font-family="ui-monospace, monospace" font-size="11" fill="#292721">${label}</text></g>`;
  }).join("");

  const legend = `<text x="24" y="28" font-family="ui-sans-serif, sans-serif" font-size="13" fill="#292721">MoltProtocol dependency map</text><text x="24" y="48" font-family="ui-sans-serif, sans-serif" font-size="11" fill="#81786B">Solid navy: confirmed relationship. Dashed brass: unresolved. ${nodes.length} modules, ${edges.length} edges.</text>`;
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#E4DCCF"/>${legend}${edgeMarkup}${nodeMarkup}${nodes.length === 0 ? `<text x="24" y="80" fill="#292721">No modules to draw.</text>` : ""}${byId.size >= 0 ? "" : ""}</svg>`;
}

export function buildPdf(lines: string[]): Buffer {
  const safe = lines.slice(0, 40).map((line) => line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").slice(0, 110));
  const commands = ["BT", "/F1 11 Tf", "48 760 Td", "14 TL", ...safe.flatMap((line) => [`(${line}) Tj`, "T*"]), "ET"];
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const startxref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;
  return Buffer.from(body, "utf8");
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
