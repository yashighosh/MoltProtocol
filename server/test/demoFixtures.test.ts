import { readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { readZip } from "../src/ingest/zipSafe.js";

const repoRoot = path.resolve(import.meta.dirname, "../..");

type FileRow = { path: string; status: string; language: string | null; loc: number; rejectionReason: string | null };
type SummaryRow = { id: string; moduleName: string; confidence: string; text: string };
type NodeRow = { id: string; name: string };
type EdgeRow = { from: string; to: string; relationship: string; resolution: string; detail: string | null };
type FindingRow = { ruleId: string; moduleName: string; impactScore: number; impactRank: number };

async function signedIn() {
  const db = openDatabase(":memory:");
  const { app, done } = createApp(db);
  const login = await request(app).post("/api/v1/auth/login").send({ email: "ada.okonkwo@moltprotocol.demo", password: "demo-pass" });
  return { app, done, token: login.body.token as string };
}

function zipPath(name: string) {
  return path.join(repoRoot, "fixtures", "demo", name);
}

async function ingestZip(fileName: string, projectName: string) {
  const { app, done, token } = await signedIn();
  const archivePath = zipPath(fileName);
  const buffer = readFileSync(archivePath);
  const opened = readZip(buffer);
  expect("error" in opened).toBe(false);
  if (!("error" in opened)) {
    expect(opened.files.every((file) => !file.path.includes("..") && !file.path.startsWith("/"))).toBe(true);
  }

  const created = await request(app)
    .post("/api/v1/projects/upload")
    .set("Authorization", `Bearer ${token}`)
    .field("name", projectName)
    .attach("archive", buffer, fileName);
  expect(created.status).toBe(202);
  const projectId = created.body.projectId as string;
  await done();

  await request(app).post(`/api/v1/projects/${projectId}/dependency-analysis`).set("Authorization", `Bearer ${token}`).expect(202);
  await done();
  await request(app).post(`/api/v1/projects/${projectId}/summaries/generate`).set("Authorization", `Bearer ${token}`).expect(202);
  await done();

  const project = await request(app).get(`/api/v1/projects/${projectId}`).set("Authorization", `Bearer ${token}`);
  const graph = await request(app).get(`/api/v1/projects/${projectId}/graph`).set("Authorization", `Bearer ${token}`);
  const summaries = await request(app).get(`/api/v1/projects/${projectId}/summaries`).set("Authorization", `Bearer ${token}`);
  return { app, done, token, projectId, project: project.body, graph: graph.body, summaries: summaries.body.summaries as SummaryRow[] };
}

function confidence(summaries: SummaryRow[], moduleName: string) {
  return summaries.find((item) => item.moduleName === moduleName)?.confidence;
}

function hasEdge(nodes: NodeRow[], edges: EdgeRow[], from: string, to: string, relationship: string, resolution: string) {
  const fromId = nodes.find((node) => node.name === from)?.id;
  const toId = nodes.find((node) => node.name === to)?.id;
  return edges.some((edge) => edge.from === fromId && edge.to === toId && edge.relationship === relationship && edge.resolution === resolution);
}

describe("demo fixture uploads", () => {
  it("ingests the billing zip and ranks the planted billing findings", async () => {
    const { app, done, token, projectId, project, graph, summaries } = await ingestZip("billing-legacy.zip", "Legacy billing");
    expect(project.ingestionStatus).toBe("complete");
    expect(project.summary.fileCount).toBe(12);
    expect(project.summary.parsedCount).toBe(11);
    expect(project.summary.rejectedCount).toBe(1);
    expect(project.summary.totalLoc).toBeGreaterThan(150);
    expect(project.summary.totalLoc).toBeLessThan(300);
    expect(project.summary.languages).toEqual([{ language: "JavaScript", files: 11, loc: project.summary.languages[0].loc }]);

    const files = project.files as FileRow[];
    const flagged = files.filter((file) => file.status !== "parsed");
    expect(flagged.map((file) => `${file.path}:${file.status}`)).toEqual(["README.md:unsupported"]);
    expect(files.filter((file) => file.status === "parsed").every((file) => file.language === "JavaScript" && file.loc > 0)).toBe(true);

    const nodes = graph.nodes as NodeRow[];
    const edges = graph.edges as EdgeRow[];
    expect(nodes.some((node) => node.name === "src/invoice/invoice.js")).toBe(true);
    expect(hasEdge(nodes, edges, "src/invoice/invoice.js", "src/tax/tax.js", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/invoice/invoice.js", "src/discounts/discount.js", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/invoice/invoice.js", "src/invoice/validate.js", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/invoice/invoice.js", "src/customers/customer.js", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/invoice/reissue.js", "src/tax/tax.js", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/invoice/reissue.js", "src/invoice/invoice.js", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/payments/payment.js", "src/payments/status.js", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/payments/payment.js", "src/invoice/invoice.js", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/legacy/calc2.js", "missing:./old_rates.js", "import", "unresolved")).toBe(true);
    expect(edges.some((edge) => edge.resolution === "unresolved" && edge.detail === "missing file")).toBe(true);

    expect(confidence(summaries, "src/tax/tax.js")).toBe("high");
    expect(confidence(summaries, "src/invoice/invoice.js")).toBe("medium");
    expect(confidence(summaries, "src/legacy/calc2.js")).toBe("low");
    const invoiceText = summaries.find((item) => item.moduleName === "src/invoice/invoice.js")?.text ?? "";
    expect(invoiceText).toMatch(/discount is applied before tax/i);

    for (const moduleName of ["src/invoice/invoice.js", "src/invoice/reissue.js", "src/payments/payment.js", "src/legacy/calc2.js"]) {
      const summary = summaries.find((item) => item.moduleName === moduleName);
      expect(summary).toBeTruthy();
      await request(app).post(`/api/v1/summaries/${summary!.id}/confirm`).set("Authorization", `Bearer ${token}`).expect(200);
    }
    await request(app).post(`/api/v1/projects/${projectId}/discrepancies/detect`).set("Authorization", `Bearer ${token}`).expect(202);
    await done();
    const discrepancies = await request(app).get(`/api/v1/projects/${projectId}/discrepancies`).set("Authorization", `Bearer ${token}`);
    expect(discrepancies.body.discrepancyStatus).toBe("complete");
    const items = discrepancies.body.items as FindingRow[];
    const scores = items.map((item) => item.impactScore);
    expect(scores).toEqual([...scores].sort((left, right) => right - left));
    expect(items.map((item) => `${item.impactRank}:${item.ruleId}:${item.moduleName}`)).toEqual([
      "1:discount-applied-after-tax:src/invoice/invoice.js",
      "2:tax-applied-more-than-once:src/invoice/reissue.js",
      "3:empty-catch:src/payments/payment.js",
      "4:unresolved-dependency:src/legacy/calc2.js",
      "5:unfinished-marker:src/legacy/calc2.js",
    ]);
  });

  it("ingests the inventory zip and ranks the three applicable findings", async () => {
    const { app, done, token, projectId, project, graph, summaries } = await ingestZip("inventory-legacy.zip", "Legacy inventory");
    expect(project.ingestionStatus).toBe("complete");
    expect(project.summary.fileCount).toBe(13);
    expect(project.summary.parsedCount).toBe(11);
    expect(project.summary.rejectedCount).toBe(2);
    expect(project.summary.totalLoc).toBeGreaterThan(100);
    expect(project.summary.totalLoc).toBeLessThan(300);
    expect(project.summary.languages).toEqual([{ language: "TypeScript", files: 11, loc: project.summary.languages[0].loc }]);

    const files = project.files as FileRow[];
    const flagged = files.filter((file) => file.status !== "parsed").map((file) => `${file.path}:${file.status}:${file.language ?? ""}`);
    expect(flagged.sort()).toEqual([
      "config/warehouses.json:unsupported:",
      "src/legacy/label_printer.js:corrupted:JavaScript",
    ]);
    expect(files.filter((file) => file.status === "parsed").every((file) => file.language === "TypeScript" && file.loc > 0)).toBe(true);

    const nodes = graph.nodes as NodeRow[];
    const edges = graph.edges as EdgeRow[];
    expect(hasEdge(nodes, edges, "src/orders/order.ts", "src/warehouse/warehouse.ts", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/orders/order.ts", "src/inventory/reservation.ts", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/orders/order.ts", "src/products/product.ts", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/orders/cancel.ts", "src/inventory/reservation.ts", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/orders/cancel.ts", "src/orders/order.ts", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/shipping/shipment.ts", "src/shipping/carrier.ts", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/shipping/shipment.ts", "src/orders/order.ts", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/inventory/reservation.ts", "src/inventory/stock.ts", "import", "confirmed")).toBe(true);
    expect(hasEdge(nodes, edges, "src/shipping/shipment.ts", "missing:../legacy/barcode", "import", "unresolved")).toBe(true);
    expect(edges.some((edge) => edge.resolution === "unresolved" && edge.detail === "missing file")).toBe(true);

    expect(confidence(summaries, "src/inventory/stock.ts")).toBe("high");
    expect(confidence(summaries, "src/inventory/adj2.ts")).toBe("low");

    for (const moduleName of ["src/shipping/shipment.ts", "src/orders/order.ts"]) {
      const summary = summaries.find((item) => item.moduleName === moduleName);
      expect(summary).toBeTruthy();
      await request(app).post(`/api/v1/summaries/${summary!.id}/confirm`).set("Authorization", `Bearer ${token}`).expect(200);
    }
    await request(app).post(`/api/v1/projects/${projectId}/discrepancies/detect`).set("Authorization", `Bearer ${token}`).expect(202);
    await done();
    const discrepancies = await request(app).get(`/api/v1/projects/${projectId}/discrepancies`).set("Authorization", `Bearer ${token}`);
    const items = discrepancies.body.items as FindingRow[];
    const scores = items.map((item) => item.impactScore);
    expect(scores).toEqual([...scores].sort((left, right) => right - left));
    expect(items.map((item) => item.ruleId).sort()).toEqual(["empty-catch", "unfinished-marker", "unresolved-dependency"]);
    expect(items.some((item) => item.ruleId === "discount-applied-after-tax" || item.ruleId === "tax-applied-more-than-once")).toBe(false);
    expect(items.find((item) => item.ruleId === "empty-catch")?.moduleName).toBe("src/shipping/shipment.ts");
    expect(items.find((item) => item.ruleId === "unresolved-dependency")?.moduleName).toBe("src/shipping/shipment.ts");
    expect(items.find((item) => item.ruleId === "unfinished-marker")?.moduleName).toBe("src/orders/order.ts");
  });
});
