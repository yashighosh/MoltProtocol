const PIPELINE = ["/ingestion", "/progress", "/dependency-map", "/intent-summaries", "/intent-review", "/discrepancies"];

function stageOf(pathname: string) {
  const section = `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  return PIPELINE.indexOf(section);
}

export function setTravel(from: string, to: string) {
  const start = stageOf(from);
  const end = stageOf(to);
  const root = document.documentElement;
  if (start >= 0 && end >= 0 && start !== end) root.dataset.travel = end > start ? "forward" : "back";
  else delete root.dataset.travel;
  window.setTimeout(() => delete root.dataset.travel, 320);
}

export function armSharedGraph(projectId: string) {
  document.documentElement.dataset.sharedGraph = projectId;
}

export function sharedGraphId() {
  return document.documentElement.dataset.sharedGraph ?? "";
}
