import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { storedZip } from "../src/ingest/zipSafe.js";

async function signedIn() {
  const db = openDatabase(":memory:");
  const { app, done } = createApp(db);
  const login = await request(app).post("/api/v1/auth/login").send({ email: "ada.okonkwo@moltprotocol.demo", password: "demo-pass" });
  return { app, db, done, token: login.body.token as string };
}

describe("sprint 1 API", () => {
  it("rejects a bad demo password with a specific error", async () => {
    const db = openDatabase(":memory:");
    const { app } = createApp(db);
    const response = await request(app).post("/api/v1/auth/login").send({ email: "ada.okonkwo@moltprotocol.demo", password: "wrong" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("BAD_PASSWORD");
    const unknown = await request(app).post("/api/v1/auth/login").send({ email: "nobody@example.com", password: "demo-pass" });
    expect(unknown.body.error.code).toBe("UNKNOWN_IDENTITY");
  });

  it("rejects private git targets and traversal archives", async () => {
    const { app, token, done } = await signedIn();
    const git = await request(app).post("/api/v1/projects/git").set("Authorization", `Bearer ${token}`).send({ name: "Bad", url: "https://127.0.0.1/secret.git" });
    expect(git.status).toBe(400);
    expect(git.body.error.fields.url).toMatch(/IP address/i);

    const zip = storedZip([{ name: "../evil.txt", data: "secret" }, { name: "ok.js", data: "export const value = 1;\n" }]);
    const hostile = await request(app)
      .post("/api/v1/projects/upload")
      .set("Authorization", `Bearer ${token}`)
      .field("name", "Hostile")
      .attach("archive", zip, "hostile.zip");
    expect(hostile.status).toBe(202);
    await done();
    const project = await request(app).get(`/api/v1/projects/${hostile.body.projectId}`).set("Authorization", `Bearer ${token}`);
    expect(project.body.files.some((file: { rejectionReason: string | null }) => /path traversal/i.test(file.rejectionReason || ""))).toBe(true);
  });

  it("runs the sample codebase from ingest through ranked discrepancies", async () => {
    const { app, token, done } = await signedIn();
    const created = await request(app).post("/api/v1/projects/sample").set("Authorization", `Bearer ${token}`).send({ name: "Sample legacy billing" });
    expect(created.status).toBe(202);
    const projectId = created.body.projectId as string;
    await done();

    const ingested = await request(app).get(`/api/v1/projects/${projectId}`).set("Authorization", `Bearer ${token}`);
    expect(ingested.body.ingestionStatus).toBe("complete");
    expect(ingested.body.summary.parsedCount).toBeGreaterThan(0);
    expect(ingested.body.summary.totalLoc).toBeGreaterThan(0);
    expect(ingested.body.summary.languages.map((item: { language: string }) => item.language)).toContain("JavaScript");
    const reasons = ingested.body.files.map((file: { path: string; status: string; rejectionReason: string | null }) => `${file.path}:${file.status}:${file.rejectionReason ?? ""}`);
    expect(reasons.some((line: string) => line.includes("overview.md") && line.includes("unsupported"))).toBe(true);
    expect(reasons.some((line: string) => line.includes("empty.js") && line.includes("corrupted"))).toBe(true);
    expect(reasons.some((line: string) => line.includes("broken.js") && line.includes("corrupted"))).toBe(true);
    expect(ingested.body.stages.map((event: { stage: string }) => event.stage)).toContain("parsing");

    const early = await request(app).get(`/api/v1/projects/${projectId}/graph`).set("Authorization", `Bearer ${token}`);
    expect(early.body.analysisStatus).toBe("not_started");
    expect(early.body.message).toMatch(/not been run/i);

    await request(app).post(`/api/v1/projects/${projectId}/dependency-analysis`).set("Authorization", `Bearer ${token}`).expect(202);
    await done();
    const graph = await request(app).get(`/api/v1/projects/${projectId}/graph`).set("Authorization", `Bearer ${token}`);
    expect(graph.body.analysisStatus).toBe("complete");
    const invoice = graph.body.nodes.find((node: { name: string }) => node.name === "billing/invoice.js");
    const tax = graph.body.nodes.find((node: { name: string }) => node.name === "billing/tax.js");
    expect(invoice).toBeTruthy();
    expect(graph.body.edges.some((edge: { from: string; to: string; resolution: string }) => edge.from === invoice.id && edge.to === tax.id && edge.resolution === "confirmed")).toBe(true);
    expect(graph.body.edges.some((edge: { resolution: string; detail: string | null }) => edge.resolution === "unresolved" && edge.detail === "missing file")).toBe(true);

    const detail = await request(app).get(`/api/v1/projects/${projectId}/modules/${invoice.id}`).set("Authorization", `Bearer ${token}`);
    expect(detail.body.callees.length).toBeGreaterThan(0);

    const svg = await request(app).get(`/api/v1/projects/${projectId}/graph.svg`).set("Authorization", `Bearer ${token}`).buffer(true);
    const svgText = Buffer.isBuffer(svg.body) ? svg.body.toString("utf8") : String(svg.text ?? "");
    expect(svg.status, svgText).toBe(200);
    expect(svgText).toContain("<svg");
    const pdf = await request(app).get(`/api/v1/projects/${projectId}/graph.pdf`).set("Authorization", `Bearer ${token}`).buffer(true);
    const pdfBody = Buffer.isBuffer(pdf.body) ? pdf.body : Buffer.from(String(pdf.text ?? ""));
    expect(pdf.header["content-type"]).toMatch(/pdf/);
    expect(pdfBody.subarray(0, 5).toString()).toBe("%PDF-");

    await request(app).post(`/api/v1/projects/${projectId}/summaries/generate`).set("Authorization", `Bearer ${token}`).expect(202);
    await done();
    const first = await request(app).get(`/api/v1/projects/${projectId}/summaries`).set("Authorization", `Bearer ${token}`);
    expect(first.body.demonstration).toBe(true);
    const scratch = first.body.summaries.find((item: { moduleName: string }) => item.moduleName === "util/scratch.js");
    const account = first.body.summaries.find((item: { moduleName: string }) => item.moduleName === "customers/account.js");
    const invoiceSummary = first.body.summaries.find((item: { moduleName: string }) => item.moduleName === "billing/invoice.js");
    expect(scratch.confidence).toBe("low");
    expect(account.confidence).not.toBe("low");
    expect(invoiceSummary.evidence.length).toBeGreaterThan(0);
    expect(invoiceSummary.text.toLowerCase()).toMatch(/discount/);

    await request(app).post(`/api/v1/projects/${projectId}/summaries/generate`).set("Authorization", `Bearer ${token}`);
    await done();
    const second = await request(app).get(`/api/v1/projects/${projectId}/summaries`).set("Authorization", `Bearer ${token}`);
    const again = second.body.summaries.find((item: { id: string }) => item.id === invoiceSummary.id);
    expect(again.generatedAt).toBe(invoiceSummary.generatedAt);

    const blocked = await request(app).post(`/api/v1/projects/${projectId}/discrepancies/detect`).set("Authorization", `Bearer ${token}`);
    expect(blocked.status).toBe(202);
    await done();
    const blockedBody = await request(app).get(`/api/v1/projects/${projectId}/discrepancies`).set("Authorization", `Bearer ${token}`);
    expect(blockedBody.body.discrepancyStatus).toBe("blocked");
    expect(blockedBody.body.message).toMatch(/validated intent/i);

    await request(app).post(`/api/v1/summaries/${invoiceSummary.id}/queue`).set("Authorization", `Bearer ${token}`);
    await request(app).post(`/api/v1/summaries/${account.id}/queue`).set("Authorization", `Bearer ${token}`);
    const confirmed = await request(app).post(`/api/v1/summaries/${invoiceSummary.id}/confirm`).set("Authorization", `Bearer ${token}`);
    expect(confirmed.body.status).toBe("confirmed");
    expect(confirmed.body.reviewerName).toBe("Ada Okonkwo");
    expect(confirmed.body.identityLabel).toBe("Demo identity");
    expect(confirmed.body.reviewedAt).toBeTruthy();
    const corrected = await request(app).post(`/api/v1/summaries/${account.id}/correct`).set("Authorization", `Bearer ${token}`).send({ text: "Open an account and keep the contracted discount rate for billing." });
    expect(corrected.body.status).toBe("corrected");
    expect(corrected.body.revisions.map((revision: { action: string }) => revision.action)).toEqual(["generated", "corrected"]);
    const override = await request(app).post(`/api/v1/summaries/${account.id}/correct`).set("Authorization", `Bearer ${token}`).send({ text: "A second correction." });
    expect(override.status).toBe(409);

    await request(app).post(`/api/v1/projects/${projectId}/discrepancies/detect`).set("Authorization", `Bearer ${token}`);
    await done();
    const discrepancies = await request(app).get(`/api/v1/projects/${projectId}/discrepancies`).set("Authorization", `Bearer ${token}`);
    expect(discrepancies.body.discrepancyStatus).toBe("complete");
    expect(discrepancies.body.items.length).toBeGreaterThan(0);
    const scores = discrepancies.body.items.map((item: { impactScore: number }) => item.impactScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(discrepancies.body.items.some((item: { ruleId: string; codeExcerpt: string; intentText: string }) => item.ruleId === "discount-applied-after-tax" && item.codeExcerpt && item.intentText)).toBe(true);
    expect(discrepancies.body.message).toMatch(/unreviewed/i);

    const dashboard = await request(app).get(`/api/v1/dashboard?projectId=${projectId}`).set("Authorization", `Bearer ${token}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.modulesParsed).toBeGreaterThan(0);
    expect(dashboard.body.intentSummaries).toBeGreaterThan(0);
    expect(dashboard.body.validatedByExperts).toBeGreaterThan(0);
    expect(dashboard.body.confidence.low).toBeGreaterThan(0);
    expect(dashboard.body.discrepancies).toBe(discrepancies.body.items.length);

    const matrix = await request(app).get(`/api/v1/projects/${projectId}/traceability`).set("Authorization", `Bearer ${token}`);
    expect(matrix.status).toBe(200);
    expect(matrix.body.rows.some((row: { path: string; reviewStatus: string; reviewerName: string | null }) => row.path.includes("invoice") && row.reviewStatus === "confirmed" && row.reviewerName === "Ada Okonkwo")).toBe(true);
    expect(matrix.body.rows.some((row: { path: string; reviewStatus: string }) => row.path.includes("overview.md") && row.reviewStatus === "unsupported")).toBe(true);
  });

  it("returns an empty dashboard before any project exists", async () => {
    const { app, token } = await signedIn();
    const dashboard = await request(app).get("/api/v1/dashboard").set("Authorization", `Bearer ${token}`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.projectId).toBeNull();
    expect(dashboard.body.modulesParsed).toBe(0);
    expect(dashboard.body.stageProgress).toBeNull();
    expect(dashboard.body.demonstration).toBe(false);
    expect(dashboard.body.fileCount).toBe(0);
    expect(dashboard.body.topDiscrepancies).toEqual([]);
  });

  it("opens one demonstration project through the pipeline and resets only that project", async () => {
    const { app, db, token, done } = await signedIn();
    const userProject = await request(app).post("/api/v1/projects/sample").set("Authorization", `Bearer ${token}`).send({ name: "Kept sample" });
    expect(userProject.status).toBe(202);
    await done();

    const first = await request(app).post("/api/v1/demo/open").set("Authorization", `Bearer ${token}`);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.created).toBe(true);
    const projectId = first.body.projectId as string;

    const second = await request(app).post("/api/v1/demo/open").set("Authorization", `Bearer ${token}`);
    expect(second.status).toBe(200);
    expect(second.body.projectId).toBe(projectId);
    expect(second.body.created).toBe(false);
    expect(db.prepare("SELECT COUNT(*) AS n FROM projects WHERE source_ref = ?").get("demo:fixtures/sample-legacy")).toMatchObject({ n: 1 });

    const project = await request(app).get(`/api/v1/projects/${projectId}`).set("Authorization", `Bearer ${token}`);
    expect(project.body.demonstration).toBe(true);
    expect(project.body.summary.fileCount).toBe(11);
    expect(project.body.summary.rejectedCount).toBe(3);
    const reasons = project.body.files.map((file: { path: string; status: string; rejectionReason: string | null }) => `${file.path}:${file.status}:${file.rejectionReason ?? ""}`);
    expect(reasons.some((line: string) => line.includes("overview.md") && line.includes("unsupported"))).toBe(true);
    expect(reasons.some((line: string) => line.includes("empty.js") && line.includes("corrupted"))).toBe(true);
    expect(reasons.some((line: string) => line.includes("broken.js") && line.includes("corrupted"))).toBe(true);

    const graph = await request(app).get(`/api/v1/projects/${projectId}/graph`).set("Authorization", `Bearer ${token}`);
    const invoice = graph.body.nodes.find((node: { name: string }) => node.name === "billing/invoice.js");
    const tax = graph.body.nodes.find((node: { name: string }) => node.name === "billing/tax.js");
    expect(graph.body.edges.some((edge: { from: string; to: string; resolution: string }) => edge.from === invoice.id && edge.to === tax.id && edge.resolution === "confirmed")).toBe(true);
    expect(graph.body.edges.some((edge: { resolution: string; detail: string | null }) => edge.resolution === "unresolved" && edge.detail === "missing file")).toBe(true);

    const summaries = await request(app).get(`/api/v1/projects/${projectId}/summaries`).set("Authorization", `Bearer ${token}`);
    const levels = new Set(summaries.body.summaries.map((item: { confidence: string }) => item.confidence));
    expect(levels.has("low")).toBe(true);
    expect(levels.has("medium")).toBe(true);
    expect(levels.has("high")).toBe(true);
    const scratch = summaries.body.summaries.find((item: { moduleName: string }) => item.moduleName === "util/scratch.js");
    const invoiceSummary = summaries.body.summaries.find((item: { moduleName: string }) => item.moduleName === "billing/invoice.js");
    const account = summaries.body.summaries.find((item: { moduleName: string }) => item.moduleName === "customers/account.js");
    expect(scratch.confidence).toBe("low");
    expect(scratch.evidence.length).toBeGreaterThan(0);
    expect(invoiceSummary.status).toBe("confirmed");
    expect(invoiceSummary.reviewerName).toBe("Ada Okonkwo");
    expect(account.status).toBe("corrected");
    expect(account.reviewerName).toBe("Ravi Shah");
    const accountDetail = await request(app).get(`/api/v1/summaries/${account.id}`).set("Authorization", `Bearer ${token}`);
    expect(accountDetail.body.revisions.map((revision: { action: string; text: string }) => revision.action)).toEqual(["generated", "corrected"]);
    expect(accountDetail.body.revisions[0].text).not.toBe(accountDetail.body.revisions[1].text);
    const unreviewed = summaries.body.summaries.filter((item: { status: string }) => item.status === "inferred");
    expect(unreviewed.length).toBeGreaterThanOrEqual(2);

    const discrepancies = await request(app).get(`/api/v1/projects/${projectId}/discrepancies`).set("Authorization", `Bearer ${token}`);
    expect(discrepancies.body.discrepancyStatus).toBe("complete");
    expect(discrepancies.body.items[0].impactRank).toBe(1);
    expect(discrepancies.body.items.some((item: { ruleId: string; moduleName: string; codeExcerpt: string; intentText: string }) => item.moduleName === "billing/invoice.js" && item.codeExcerpt && item.intentText)).toBe(true);
    expect(discrepancies.body.excludedUnreviewed).toBeGreaterThanOrEqual(2);

    const dashboard = await request(app).get(`/api/v1/dashboard?projectId=${projectId}`).set("Authorization", `Bearer ${token}`);
    expect(dashboard.body.demonstration).toBe(true);
    expect(dashboard.body.fileCount).toBe(11);
    expect(dashboard.body.flaggedFiles).toBe(3);
    expect(dashboard.body.modulesParsed).toBeGreaterThan(0);
    expect(dashboard.body.edgesConfirmed).toBeGreaterThan(0);
    expect(dashboard.body.edgesUnresolved).toBeGreaterThan(0);
    expect(dashboard.body.validatedByExperts).toBe(2);
    expect(dashboard.body.discrepancies).toBe(discrepancies.body.items.length);
    expect(dashboard.body.topDiscrepancies[0].impactRank).toBe(1);
    expect(dashboard.body.confidence.low).toBeGreaterThan(0);

    const unscoped = await request(app).get("/api/v1/dashboard").set("Authorization", `Bearer ${token}`);
    expect(unscoped.body.projectId).toBeNull();
    expect(unscoped.body.modulesParsed).toBe(0);

    const reset = await request(app).post("/api/v1/demo/reset").set("Authorization", `Bearer ${token}`);
    expect(reset.body.reset).toBe(true);
    const kept = await request(app).get(`/api/v1/projects/${userProject.body.projectId}`).set("Authorization", `Bearer ${token}`);
    expect(kept.status).toBe(200);
    expect(kept.body.name).toBe("Kept sample");
    const gone = await request(app).get(`/api/v1/projects/${projectId}`).set("Authorization", `Bearer ${token}`);
    expect(gone.status).toBe(404);

    const reopened = await request(app).post("/api/v1/demo/open").set("Authorization", `Bearer ${token}`);
    expect(reopened.body.created).toBe(true);
    expect(reopened.body.projectId).not.toBe(projectId);
  });
});
