import { jsPDF } from "jspdf";
import { useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode } from "../types";

type Props = {
  projectId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function GraphCanvas({ projectId, nodes, edges, selectedId, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [query, setQuery] = useState("");
  const directories = [...new Set(nodes.map((node) => node.directory))];
  const [directory, setDirectory] = useState(nodes.length > 24 ? directories[0] ?? "all" : "all");
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const visibleNodes = nodes.filter((node) => directory === "all" || node.directory === directory || node.kind !== "file");
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));
  const positions = useMemo(() => layout(visibleNodes), [visibleNodes]);
  const queryText = query.trim().toLowerCase();

  function exportCurrent(kind: "png" | "pdf") {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", "1100");
    clone.setAttribute("height", "720");
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 2200;
      canvas.height = 1440;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#F0E9DC";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const png = canvas.toDataURL("image/png");
      if (kind === "png") downloadUrl(png, "dependency-map.png");
      else {
        const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        pdf.setFontSize(12);
        pdf.text("MoltProtocol dependency map — current view", 32, 28);
        pdf.addImage(png, "PNG", 24, 40, 780, 500);
        pdf.save("dependency-map.pdf");
      }
    };
    image.src = url;
  }

  return (
    <div className="stack">
      <div className="row">
        <label>
          Search modules
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="invoice, tax, payments" />
        </label>
        <label>
          Cluster
          <select value={directory} onChange={(event) => setDirectory(event.target.value)}>
            <option value="all">All directories</option>
            {directories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button type="button" className="secondary" onClick={() => setScale((value) => Math.min(2.4, value + 0.15))}>Zoom in</button>
        <button type="button" className="secondary" onClick={() => setScale((value) => Math.max(0.4, value - 0.15))}>Zoom out</button>
        <button type="button" className="secondary" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}>Reset view</button>
        <button type="button" className="secondary" onClick={() => exportCurrent("png")}>Export PNG</button>
        <button type="button" className="secondary" onClick={() => exportCurrent("pdf")}>Export PDF</button>
        <a className="button secondary" href={`/api/v1/projects/${projectId}/graph.svg`}>Download SVG</a>
        <a className="button secondary" href={`/api/v1/projects/${projectId}/graph.pdf`}>Download print PDF</a>
      </div>
      <div className="legend">
        <span><i className="swatch" /> Confirmed relationship</span>
        <span><i className="swatch dashed" /> Unresolved relationship</span>
      </div>
      {nodes.length > 24 && directory !== "all" && <p>Showing the {directory} cluster so the map stays readable. Choose All directories to expand it.</p>}
      <div className="graph-wrap">
        <svg
          ref={svgRef}
          viewBox="0 0 1100 720"
          role="img"
          aria-label="Dependency map"
          onWheel={(event) => {
            event.preventDefault();
            setScale((value) => Math.min(2.4, Math.max(0.4, value + (event.deltaY < 0 ? 0.08 : -0.08))));
          }}
          onPointerDown={(event) => {
            drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setPan({ x: drag.current.panX + event.clientX - drag.current.x, y: drag.current.panY + event.clientY - drag.current.y });
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerLeave={() => { drag.current = null; }}
        >
          <rect width="1100" height="720" fill="#F0E9DC" />
          <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
            {visibleEdges.map((edge) => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              if (!from || !to) return null;
              return (
                <line
                  key={edge.id}
                  x1={from.x + 150}
                  y1={from.y + 18}
                  x2={to.x}
                  y2={to.y + 18}
                  stroke={edge.resolution === "confirmed" ? "#263B50" : "#B18B42"}
                  strokeDasharray={edge.resolution === "confirmed" ? undefined : "5 4"}
                  strokeWidth="1.4"
                />
              );
            })}
            {visibleNodes.map((node) => {
              const at = positions.get(node.id);
              if (!at) return null;
              const dim = queryText.length > 0 && !node.name.toLowerCase().includes(queryText);
              return (
                <g
                  key={node.id}
                  className={`graph-node${selectedId === node.id ? " selected" : ""}${dim ? " dim" : ""}`}
                  transform={`translate(${at.x} ${at.y})`}
                  tabIndex={0}
                  role="button"
                  aria-pressed={selectedId === node.id}
                  aria-label={node.name}
                  onClick={() => onSelect(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(node.id);
                    }
                  }}
                >
                  <rect width="160" height="36" rx="2" />
                  <text x="8" y="22" fontFamily="ui-monospace, monospace" fontSize="11" fill="#292721">
                    {(node.name.split("/").pop() ?? node.name).slice(0, 22)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

function layout(nodes: GraphNode[]) {
  const groups = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const key = node.directory || "(root)";
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }
  const positions = new Map<string, { x: number; y: number }>();
  let column = 0;
  for (const group of groups.values()) {
    group.forEach((node, row) => positions.set(node.id, { x: 24 + column * 210, y: 24 + row * 56 }));
    column += 1;
  }
  return positions;
}

function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}
