import { jsPDF } from "jspdf";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode } from "../types";

type Props = {
  projectId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  shared?: boolean;
};

function unresolvedNode(node: GraphNode) {
  return node.resolution === "unresolved" || node.name.startsWith("missing:");
}

function nodeWidth(node: GraphNode) {
  const shortName = (node.name.split("/").pop() ?? node.name).replace(/^missing:/, "");
  const label = (unresolvedNode(node) ? `${shortName} (missing)` : shortName).slice(0, 32);
  return Math.max(128, Math.min(220, label.length * 7.2 + 32));
}

function layout(nodes: GraphNode[], edges: GraphEdge[]) {
  const ids = new Set(nodes.map((node) => node.id));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  for (const node of nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, 0);
  }
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) continue;
    outgoing.get(edge.from)?.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }
  const depth = new Map<string, number>();
  const queue = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);
  for (const id of queue) depth.set(id, 0);
  const pending = [...queue];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const id = pending.shift() ?? "";
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of outgoing.get(id) ?? []) {
      const nextDepth = (depth.get(id) ?? 0) + (nodes.find((node) => node.id === next && unresolvedNode(node)) ? 0 : 1);
      if ((depth.get(next) ?? -1) < nextDepth) depth.set(next, nextDepth);
      pending.push(next);
    }
  }
  for (const node of nodes) if (!depth.has(node.id)) depth.set(node.id, unresolvedNode(node) ? 1 : 0);
  const columns = new Map<number, GraphNode[]>();
  for (const node of [...nodes].sort((left, right) => left.name.localeCompare(right.name))) {
    const column = depth.get(node.id) ?? 0;
    const list = columns.get(column) ?? [];
    list.push(node);
    columns.set(column, list);
  }
  const positions = new Map<string, { x: number; y: number }>();
  for (const column of [...columns.keys()].sort((left, right) => left - right)) {
    const list = columns.get(column) ?? [];
    list.sort((left, right) => Number(unresolvedNode(left)) - Number(unresolvedNode(right)) || left.name.localeCompare(right.name));
    list.forEach((node, row) => positions.set(node.id, { x: 170 + column * 200, y: 96 + row * 84 }));
  }
  return positions;
}

function fitOf(positions: Map<string, { x: number; y: number }>) {
  const points = [...positions.values()];
  if (points.length === 0) return { scale: 1, pan: { x: 0, y: 0 }, open: { scale: 1, pan: { x: 0, y: 0 } } };
  const minX = Math.min(...points.map((point) => point.x)) - 110;
  const maxX = Math.max(...points.map((point) => point.x)) + 110;
  const minY = Math.min(...points.map((point) => point.y)) - 40;
  const maxY = Math.max(...points.map((point) => point.y)) + 40;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const scale = Math.min((1100 - 96) / width, (720 - 96) / height, 1.4);
  const fittedPan = { x: (1100 - width * scale) / 2 - minX * scale, y: (720 - height * scale) / 2 - minY * scale };
  const opensFitted = scale >= 1;
  return {
    scale,
    pan: fittedPan,
    open: opensFitted ? { scale, pan: fittedPan } : { scale: 1, pan: { x: 48 - minX, y: 48 - minY } },
  };
}

export function GraphCanvas({ projectId, nodes, edges, selectedId, onSelect, shared = false }: Props) {
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
  const layoutKey = `${directory}|${visibleNodes.map((node) => node.id).join(",")}|${visibleEdges.map((edge) => edge.id).join(",")}`;
  const positions = useMemo(() => layout(visibleNodes, visibleEdges), [layoutKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const fitted = useMemo(() => fitOf(positions), [positions]);
  const queryText = query.trim().toLowerCase();

  useEffect(() => {
    setScale(fitted.open.scale);
    setPan(fitted.open.pan);
  }, [fitted]);

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
      context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg-canvas").trim();
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const png = canvas.toDataURL("image/png");
      if (kind === "png") downloadUrl(png, "dependency-map.png");
      else {
        const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        pdf.setFontSize(12);
        pdf.text("MoltProtocol dependency map, current view", 32, 28);
        pdf.addImage(png, "PNG", 24, 40, 780, 500);
        pdf.save("dependency-map.pdf");
      }
    };
    image.src = url;
  }

  return (
    <div className="map-controls">
      <div className="map-toolbar">
        <label>
          Search modules
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="invoice, tax, payments" />
        </label>
        <label>
          Cluster
          <select value={directory} onChange={(event) => setDirectory(event.target.value)}>
            <option value="all">All directories</option>
            {directories.map((item) => <option key={item} value={item}>{item || "(root)"}</option>)}
          </select>
        </label>
        <div className="map-actions">
          <span>View</span>
          <div>
            <button type="button" className="secondary" onClick={() => setScale((value) => Math.min(2.4, value + 0.15))}>Zoom in</button>
            <button type="button" className="secondary" onClick={() => setScale((value) => Math.max(0.4, value - 0.15))}>Zoom out</button>
            <button type="button" className="secondary" onClick={() => { setScale(fitted.scale); setPan(fitted.pan); }}>Fit</button>
            <button type="button" className="secondary" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}>Reset view</button>
          </div>
        </div>
        <div className="map-actions">
          <span>Export</span>
          <div>
            <button type="button" className="secondary" onClick={() => exportCurrent("png")}>PNG</button>
            <button type="button" className="secondary" onClick={() => exportCurrent("pdf")}>PDF</button>
            <a className="button secondary" href={`/api/v1/projects/${projectId}/graph.svg`}>SVG</a>
            <a className="button secondary" href={`/api/v1/projects/${projectId}/graph.pdf`}>Print PDF</a>
          </div>
        </div>
      </div>
      <div className="legend">
        <span><i className="legend-line" /> Confirmed relationship</span>
        <span><i className="legend-line dashed" /> Unresolved relationship</span>
      </div>
      {nodes.length > 24 && directory !== "all" && <p className="map-note">Showing the {directory} cluster so the map stays readable. Choose All directories to expand it.</p>}
      <div className="graph-wrap" style={shared ? { viewTransitionName: "project-graph" } : undefined}>
        <svg
          ref={svgRef}
          viewBox="0 0 1100 720"
          role="group"
          aria-label="Dependency map"
          onWheel={(event) => {
            event.preventDefault();
            setScale((value) => Math.min(2.4, Math.max(0.4, value + (event.deltaY < 0 ? 0.08 : -0.08))));
          }}
          onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }; }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setPan({ x: drag.current.panX + event.clientX - drag.current.x, y: drag.current.panY + event.clientY - drag.current.y });
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerLeave={() => { drag.current = null; }}
        >
          <defs>
            <pattern id="graph-dots" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="var(--border)" />
            </pattern>
          </defs>
          <rect width="1100" height="720" fill="var(--bg-sunken)" />
          <rect width="1100" height="720" fill="url(#graph-dots)" />
          <g transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}>
            {visibleEdges.map((edge) => {
              const from = positions.get(edge.from);
              const to = positions.get(edge.to);
              const fromNode = visibleNodes.find((node) => node.id === edge.from);
              const toNode = visibleNodes.find((node) => node.id === edge.to);
              if (!from || !to || !fromNode || !toNode) return null;
              const confirmed = edge.resolution === "confirmed";
              const highlighted = edge.from === selectedId || edge.to === selectedId;
              const forward = to.x >= from.x;
              const x1 = from.x + (forward ? nodeWidth(fromNode) / 2 : -nodeWidth(fromNode) / 2);
              const x2 = to.x + (forward ? -nodeWidth(toNode) / 2 : nodeWidth(toNode) / 2);
              return (
                <path
                  key={edge.id}
                  d={`M ${x1} ${from.y} L ${x2} ${to.y}`}
                  pathLength={1}
                  strokeWidth={highlighted ? 1.6 : 1.15}
                  className={`${confirmed ? "edge-confirmed" : "edge-unresolved"}${highlighted ? " hot" : ""}`}
                />
              );
            })}
            {visibleNodes.map((node) => {
              const at = positions.get(node.id);
              if (!at) return null;
              const dim = queryText.length > 0 && !node.name.toLowerCase().includes(queryText);
              const unresolved = unresolvedNode(node);
              const shortName = (node.name.split("/").pop() ?? node.name).replace(/^missing:/, "");
              const label = (unresolved ? `${shortName} (missing)` : shortName).slice(0, 32);
              const width = nodeWidth(node);
              return (
                <g
                  key={node.id}
                  className={`graph-node${selectedId === node.id ? " selected" : ""}${dim ? " dim" : ""}${unresolved ? " missing" : ""}`}
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
                  <g className="graph-node-in">
                    <rect x={-width / 2} y={-18} width={width} height="36" rx="8" fill="var(--surface-raised)" stroke={unresolved ? "var(--danger-line)" : "var(--border-strong)"} strokeDasharray={unresolved ? "5 4" : undefined} />
                    <text x="0" y="5" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="12" fill={unresolved ? "var(--danger-line)" : "var(--text-primary)"}>
                      {label}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}

function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}
