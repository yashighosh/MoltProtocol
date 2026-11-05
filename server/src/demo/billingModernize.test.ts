import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { openDatabase, run } from "../db.js";

function project(db: ReturnType<typeof openDatabase>, id: string, name: string) {
  const now = new Date().toISOString();
  run(
    db,
    `INSERT INTO projects (
      id, name, source_type, ingestion_status, ingestion_stage, analysis_status, summary_status,
      discrepancy_status, excluded_unreviewed, created_at, updated_at
    ) VALUES (?, ?, 'upload', 'complete', 'done', 'complete', 'complete', 'complete', 0, ?, ?)`,
    id,
    name,
    now,
    now,
  );
}

describe("Legacy Billing modernization demonstration", () => {
  it("serves the recorded walkthrough only for the billing sample", async () => {
    const db = openDatabase(":memory:");
    const { app } = createApp(db);
    const login = await request(app).post("/api/v1/auth/login").send({ email: "ada.okonkwo@moltprotocol.demo", password: "demo-pass" });
    const token = login.body.token as string;
    project(db, "other", "Inventory");
    project(db, "billing", "Legacy Billing");
    run(db, "INSERT INTO modules (id, project_id, name, kind, directory) VALUES ('m-invoice', 'billing', 'src/invoice/invoice.js', 'file', 'src/invoice')");

    const missing = await request(app).get("/api/v1/projects/other/architecture/proposals").set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(404);

    const proposals = await request(app).get("/api/v1/projects/billing/architecture/proposals").set("Authorization", `Bearer ${token}`);
    expect(proposals.status).toBe(200);
    expect(proposals.body.items[0].id).toBe("billing-demo-proposal");

    const detail = await request(app).get("/api/v1/projects/billing/architecture/proposals/billing-demo-proposal").set("Authorization", `Bearer ${token}`);
    expect(detail.body.mappings.some((item: { moduleName: string; moduleId: string }) => item.moduleName === "src/invoice/invoice.js" && item.moduleId === "m-invoice")).toBe(true);

    const check = await request(app).get("/api/v1/projects/billing/rule-checks/billing-demo-check").set("Authorization", `Bearer ${token}`);
    const discount = check.body.rows.find((row: { ruleKey: string }) => row.ruleKey === "BR-B01");
    expect(discount.status).toBe("distorted");
    expect(check.body.rows.find((row: { ruleKey: string }) => row.ruleKey === "BR-B07").status).toBe("preserved");

    const rules = await request(app).get("/api/v1/projects/billing/compliance/rules").set("Authorization", `Bearer ${token}`);
    expect(rules.body.items).toHaveLength(8);

    const recorded = await request(app)
      .post("/api/v1/projects/billing/compliance/rules/br-b01/decisions")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "modified", justification: "Discount will move ahead of tax in the target invoice service." });
    expect(recorded.status).toBe(200);
    expect(recorded.body.migration.status).toBe("modified");

    const suite = await request(app).get("/api/v1/projects/billing/test-suites/billing-demo-suite").set("Authorization", `Bearer ${token}`);
    expect(suite.body.cases.some((item: { outcome: string }) => item.outcome === "fail")).toBe(true);

    const overview = await request(app).get("/api/v1/projects/billing/leadership/overview").set("Authorization", `Bearer ${token}`);
    expect(overview.body.narrative).toMatch(/Legacy Billing/);
    expect(overview.body.verified).toBe(0);
    expect(overview.body.rulesLine).toMatch(/1 preserved/);
  });
});
