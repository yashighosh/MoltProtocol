import type { Express, NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { all, one, run, type AppDatabase } from "../db.js";
import { HttpError } from "../http.js";
import { requireProject } from "../pipeline.js";

const PROPOSAL_ID = "billing-demo-proposal";
const CHECK_ID = "billing-demo-check";
const SUITE_ID = "billing-demo-suite";
const EXECUTION_ID = "billing-demo-run";
const JOB_ID = "billing-demo-job";

type EditOperation =
  | { op: "rename_component"; componentKey: string; name: string }
  | { op: "set_kind"; componentKey: string; kind: string }
  | { op: "move_module"; moduleId: string; toComponentKey: string; rationale: string };

const edits = new Map<string, { version: number; note: string | null; operations: EditOperation[] }>();

type RuleSeed = {
  id: string;
  ruleKey: string;
  statement: string;
  module: string;
  coverage: "preserved" | "mentioned_only" | "distorted" | "dropped";
  componentKey: string | null;
  responsibility: string | null;
  reason: string;
  suggestion: string | null;
};

const RULES: RuleSeed[] = [
  {
    id: "br-b01",
    ruleKey: "BR-B01",
    statement: "Discount is applied before tax.",
    module: "src/invoice/invoice.js",
    coverage: "distorted",
    componentKey: "invoicing",
    responsibility: "Invoicing calls tax and then discount. The accepted rule is the opposite order.",
    reason: "The stored discrepancy discount-applied-after-tax is on this module. The design names the rule, but the call order does not carry it.",
    suggestion: "Move the discount call ahead of the tax call inside generateInvoice.",
  },
  {
    id: "br-b02",
    ruleKey: "BR-B02",
    statement: "Tax is applied once per invoice.",
    module: "src/invoice/reissue.js",
    coverage: "distorted",
    componentKey: "invoicing",
    responsibility: "Reissue rebuilds an invoice that already includes tax.",
    reason: "The stored discrepancy tax-applied-more-than-once is on this module.",
    suggestion: "Reissue from the pre-tax amount, or skip tax when the invoice was already taxed.",
  },
  {
    id: "br-b03",
    ruleKey: "BR-B03",
    statement: "A receipt failure must not be discarded.",
    module: "src/payments/payment.js",
    coverage: "dropped",
    componentKey: "payments",
    responsibility: null,
    reason: "processPayment catches the receipt error and continues. No payment responsibility carries this rule.",
    suggestion: "Surface the receipt failure instead of the empty catch.",
  },
  {
    id: "br-b04",
    ruleKey: "BR-B04",
    statement: "The rate table used by the legacy calculator must be present.",
    module: "src/legacy/calc2.js",
    coverage: "dropped",
    componentKey: null,
    responsibility: null,
    reason: "calc2.js imports ./old_rates.js, and that file is not in the ingest.",
    suggestion: "Restore old_rates.js or retire the calculator and record that decision.",
  },
  {
    id: "br-b05",
    ruleKey: "BR-B05",
    statement: "Unfinished rate-branch work must be called out in the intent.",
    module: "src/legacy/calc2.js",
    coverage: "mentioned_only",
    componentKey: "legacy-rates",
    responsibility: null,
    reason: "The legacy rates component describes the unfinished branch. No affirmed responsibility carries the rule.",
    suggestion: "Affirm the unfinished work as a responsibility, or retire the component.",
  },
  {
    id: "br-b06",
    ruleKey: "BR-B06",
    statement: "Total discount is capped at 20 percent. The code caps only the loyalty part.",
    module: "src/discounts/discount.js",
    coverage: "distorted",
    componentKey: "discounts",
    responsibility: "Discounts applies volume plus loyalty and caps only the loyalty portion.",
    reason: "Volume and loyalty together can pass 20 percent. The component describes the cap, but the calculation does not enforce it on the total.",
    suggestion: "Cap the combined rate at 0.2 after volume and loyalty are added.",
  },
  {
    id: "br-b07",
    ruleKey: "BR-B07",
    statement: "An invoice needs an active customer and a total greater than zero.",
    module: "src/invoice/validate.js",
    coverage: "preserved",
    componentKey: "invoicing",
    responsibility: "validateInvoice rejects a missing customer and a non-positive total.",
    reason: "The invoicing component affirms this rule.",
    suggestion: null,
  },
  {
    id: "br-b08",
    ruleKey: "BR-B08",
    statement: "isPaid means the invoice is fully paid.",
    module: "src/payments/status.js",
    coverage: "distorted",
    componentKey: "payments",
    responsibility: "isPaid returns true when the amount covers 90 percent of the total.",
    reason: "The comment says fully paid. The comparison uses 90 percent.",
    suggestion: "Treat the invoice as paid only when the amount covers the total.",
  },
];

const COMPONENTS = [
  { key: "invoicing", name: "Invoicing", kind: "service", modules: ["src/invoice/invoice.js", "src/invoice/reissue.js", "src/invoice/validate.js"], boundary: "Owns invoice creation, reissue, and the checks that must pass before a total is issued." },
  { key: "tax", name: "Tax", kind: "service", modules: ["src/tax/tax.js", "src/tax/tax.test.js"], boundary: "Owns the single tax calculation the invoice is supposed to call once." },
  { key: "discounts", name: "Discounts", kind: "service", modules: ["src/discounts/discount.js"], boundary: "Owns volume and loyalty reductions, including the 20 percent cap." },
  { key: "payments", name: "Payments", kind: "service", modules: ["src/payments/payment.js", "src/payments/status.js"], boundary: "Owns taking payment and deciding when an invoice counts as paid." },
  { key: "customers", name: "Customers", kind: "service", modules: ["src/customers/customer.js"], boundary: "Owns the customer record an invoice has to reference." },
  { key: "legacy-rates", name: "Legacy rates", kind: "legacy", modules: ["src/legacy/calc2.js"], boundary: "The old calculator. It stays visible because its rate file is missing and the rate branch is unfinished." },
];

export function isLegacyBillingDemo(db: AppDatabase, projectId: string) {
  const project = requireProject(db, projectId);
  const invoice = one<{ id: string }>(db, "SELECT id FROM modules WHERE project_id = ? AND name = ?", projectId, "src/invoice/invoice.js");
  return Boolean(invoice) || /legacy billing/i.test(project.name);
}

function moduleId(db: AppDatabase, projectId: string, name: string) {
  return one<{ id: string }>(db, "SELECT id FROM modules WHERE project_id = ? AND name = ?", projectId, name)?.id ?? `demo:${name}`;
}

function summaryFor(db: AppDatabase, projectId: string, moduleName: string) {
  return one<{ id: string; text: string; status: string; reviewed_at: string | null; display_name: string | null }>(
    db,
    `SELECT s.id, s.text, s.status, s.reviewed_at, u.display_name
     FROM modules m
     LEFT JOIN intent_summaries s ON s.module_id = m.id
     LEFT JOIN users u ON u.id = s.reviewer_id
     WHERE m.project_id = ? AND m.name = ?`,
    projectId,
    moduleName,
  );
}

function proposalDetail(db: AppDatabase, projectId: string) {
  const stored = edits.get(projectId);
  const components = COMPONENTS.map((component) => ({
    id: `cmp-${component.key}`,
    componentKey: component.key,
    name: component.name,
    kind: component.kind,
    description: component.boundary,
    boundaryRationale: component.boundary,
  }));
  const mappings = COMPONENTS.flatMap((component) => component.modules.map((moduleName) => {
    const summary = summaryFor(db, projectId, moduleName);
    return {
      id: `map-${moduleName}`,
      componentId: `cmp-${component.key}`,
      moduleId: moduleId(db, projectId, moduleName),
      moduleName,
      rationale: `${moduleName} stays in ${component.name} because that is the boundary it already implements in this ingest.`,
      intentText: summary?.text ?? null,
      reviewerName: summary?.display_name ?? null,
      reviewedAt: summary?.reviewed_at ?? null,
      reviewHref: summary?.id ? `/intent-summaries/${projectId}?summary=${summary.id}` : `/intent-review/${projectId}`,
    };
  }));
  const responsibilities = RULES.filter((rule) => rule.responsibility && rule.componentKey).map((rule) => ({
    id: `resp-${rule.id}`,
    componentId: `cmp-${rule.componentKey}`,
    statement: rule.responsibility as string,
    ruleKey: rule.ruleKey,
    affirmed: rule.coverage === "preserved",
  }));
  for (const operation of stored?.operations ?? []) {
    if (operation.op === "move_module") {
      const target = components.find((component) => component.componentKey === operation.toComponentKey);
      const mapping = mappings.find((item) => item.moduleId === operation.moduleId);
      if (target && mapping) {
        mapping.componentId = target.id;
        mapping.rationale = operation.rationale;
      }
    }
    if (operation.op === "rename_component") {
      const component = components.find((item) => item.componentKey === operation.componentKey);
      if (component) component.name = operation.name;
    }
    if (operation.op === "set_kind") {
      const component = components.find((item) => item.componentKey === operation.componentKey);
      if (component) component.kind = operation.kind;
    }
  }
  const links = [
    ["invoicing", "tax"],
    ["invoicing", "discounts"],
    ["invoicing", "customers"],
    ["payments", "invoicing"],
    ["invoicing", "legacy-rates"],
  ];
  return {
    proposal: { id: PROPOSAL_ID, name: "Legacy Billing target", status: "demonstration", version: stored?.version ?? 1 },
    version: { id: "billing-demo-version", version: stored?.version ?? 1, origin: "demonstration", changeNote: stored?.note ?? "Recorded from the Legacy Billing sample. This is not a generated redesign." },
    scope: [
      ...mappings.map((mapping) => ({ moduleId: mapping.moduleId, moduleName: mapping.moduleName, state: "mapped", reason: null })),
      { moduleId: moduleId(db, projectId, "src/util/ids.js"), moduleName: "src/util/ids.js", state: "excluded", reason: "Shared id helper. It is not a billing boundary." },
      { moduleId: moduleId(db, projectId, "missing:./old_rates.js"), moduleName: "missing:./old_rates.js", state: "retired", reason: "The rate table is not in the ingest." },
    ],
    components,
    mappings,
    relationships: links.map(([from, to]) => ({
      id: `rel-${from}-${to}`,
      fromComponentId: `cmp-${from}`,
      toComponentId: `cmp-${to}`,
      kind: "calls",
      derivedEdgeCount: null,
    })),
    responsibilities,
    staleReason: null,
  };
}

function counts() {
  return {
    preserved: RULES.filter((rule) => rule.coverage === "preserved").length,
    mentionedOnly: RULES.filter((rule) => rule.coverage === "mentioned_only").length,
    distorted: RULES.filter((rule) => rule.coverage === "distorted").length,
    dropped: RULES.filter((rule) => rule.coverage === "dropped").length,
    retired: 0,
    notInScope: 0,
  };
}

function ruleCheck() {
  const tally = counts();
  return {
    runId: CHECK_ID,
    architectureLabel: "Legacy Billing target v1",
    architectureVersionId: "billing-demo-version",
    stale: false,
    staleReason: null,
    counts: tally,
    rows: RULES.map((rule) => ({
      id: `cov-${rule.id}`,
      ruleId: rule.id,
      ruleKey: rule.ruleKey,
      statement: rule.statement,
      status: rule.coverage,
      componentKey: rule.componentKey,
      componentName: COMPONENTS.find((component) => component.key === rule.componentKey)?.name ?? null,
      reason: rule.reason,
      responsibility: rule.responsibility,
      sourcePath: rule.module,
    })),
  };
}

function decisions(db: AppDatabase, projectId: string, ruleId: string) {
  return all<{ id: string; status: string; justification: string | null; decided_by: string | null; decided_at: string }>(
    db,
    "SELECT id, status, justification, decided_by, decided_at FROM demo_rule_decisions WHERE project_id = ? AND rule_id = ? ORDER BY decided_at",
    projectId,
    ruleId,
  );
}

function migrationStatus(db: AppDatabase, projectId: string, rule: RuleSeed) {
  const history = decisions(db, projectId, rule.id);
  const latest = history.at(-1);
  if (latest) return latest.status;
  return rule.coverage === "preserved" ? "preserved" : "unassessed";
}

function ruleRow(db: AppDatabase, projectId: string, rule: RuleSeed, status: string) {
  return {
    id: rule.id,
    ruleKey: rule.ruleKey,
    statement: rule.statement,
    status,
    moduleId: moduleId(db, projectId, rule.module),
    moduleName: rule.module,
    counted: status === "accepted" || status === "preserved",
  };
}

function ruleTrace(db: AppDatabase, projectId: string, ruleId: string) {
  const rule = RULES.find((item) => item.id === ruleId);
  if (!rule) throw new HttpError(404, "NOT_FOUND", "That rule is not in the Legacy Billing demonstration.");
  const summary = summaryFor(db, projectId, rule.module);
  const history = decisions(db, projectId, rule.id);
  const latest = history.at(-1);
  const status = migrationStatus(db, projectId, rule);
  return {
    rule: ruleRow(db, projectId, rule, status),
    legacy: { path: rule.module, lines: null, snippet: null, drifted: false },
    intent: {
      text: summary?.text ?? null,
      revision: summary?.status ?? null,
      reviewer: summary?.display_name ?? null,
      reviewedAt: summary?.reviewed_at ?? null,
      note: null,
    },
    architecture: {
      componentKey: rule.componentKey,
      componentName: COMPONENTS.find((component) => component.key === rule.componentKey)?.name ?? null,
      version: "1",
      coverage: rule.coverage,
      stale: false,
    },
    migration: {
      status,
      justification: latest?.justification ?? (status === "preserved" ? "The invoicing component affirms this check." : null),
      decidedBy: latest?.decided_by ?? (status === "preserved" ? "Legacy Billing demonstration" : null),
      decidedAt: latest?.decided_at ?? null,
      versionNote: "Demonstration ledger for the Legacy Billing sample.",
    },
    history: history.map((item) => ({
      id: item.id,
      status: item.status,
      justification: item.justification,
      decidedBy: item.decided_by,
      decidedAt: item.decided_at,
    })),
    suggestion: rule.suggestion,
  };
}

const CASES = [
  {
    id: "case-discount-order",
    name: "Discount is applied before tax",
    method: "POST",
    path: "/invoices",
    outcome: "fail" as const,
    ruleKey: "BR-B01",
    legacyBody: '{ "subtotal": 100, "steps": ["tax", "discount"], "total": 108 }',
    modernizedBody: '{ "subtotal": 100, "steps": ["discount", "tax"], "total": 105 }',
    diff: [{ path: "steps", kind: "changed", legacy: "tax, discount", modernized: "discount, tax" }],
  },
  {
    id: "case-tax-once",
    name: "Reissue taxes the invoice once",
    method: "POST",
    path: "/invoices/reissue",
    outcome: "fail" as const,
    ruleKey: "BR-B02",
    legacyBody: '{ "taxCalls": 2, "total": 116.64 }',
    modernizedBody: '{ "taxCalls": 1, "total": 108 }',
    diff: [{ path: "taxCalls", kind: "changed", legacy: "2", modernized: "1" }],
  },
  {
    id: "case-receipt",
    name: "A receipt failure is not discarded",
    method: "POST",
    path: "/payments",
    outcome: "fail" as const,
    ruleKey: "BR-B03",
    legacyBody: '{ "status": "paid", "receiptError": "swallowed" }',
    modernizedBody: '{ "status": "receipt_failed", "receiptError": "printer unavailable" }',
    diff: [{ path: "receiptError", kind: "changed", legacy: "swallowed", modernized: "printer unavailable" }],
  },
  {
    id: "case-paid",
    name: "Paid means the total is covered",
    method: "GET",
    path: "/invoices/status?amount=90&total=100",
    outcome: "fail" as const,
    ruleKey: "BR-B08",
    legacyBody: '{ "isPaid": true, "amount": 90, "total": 100 }',
    modernizedBody: '{ "isPaid": false, "amount": 90, "total": 100 }',
    diff: [{ path: "isPaid", kind: "changed", legacy: "true", modernized: "false" }],
  },
  {
    id: "case-customer",
    name: "An invoice needs an active customer",
    method: "POST",
    path: "/invoices/validate",
    outcome: "pass" as const,
    ruleKey: "BR-B07",
    legacyBody: '{ "accepted": false, "reason": "customer inactive" }',
    modernizedBody: '{ "accepted": false, "reason": "customer inactive" }',
    diff: [],
  },
];

function suiteDetail() {
  return {
    id: SUITE_ID,
    name: "Legacy Billing walkthrough",
    legacy: { id: "ep-legacy", role: "legacy" as const, name: "Recorded Legacy Billing sample", baseUrl: "demo://legacy-billing" },
    modernized: { id: "ep-target", role: "modernized" as const, name: "Recorded target billing", baseUrl: "demo://target-billing" },
    cases: CASES.map((item) => ({
      id: item.id,
      name: item.name,
      method: item.method,
      path: item.path,
      outcome: item.outcome,
      errorDetail: null,
      ruleKey: item.ruleKey,
    })),
  };
}

function executionDetail() {
  const passed = CASES.filter((item) => item.outcome === "pass").length;
  const failed = CASES.filter((item) => item.outcome === "fail").length;
  return {
    summary: {
      id: EXECUTION_ID,
      status: "recorded",
      passed,
      failed,
      errored: 0,
      passRate: Math.round((passed / CASES.length) * 100),
      startedAt: null,
      finishedAt: null,
      requestedBy: "Legacy Billing demonstration",
      legacyName: "Recorded Legacy Billing sample",
      modernizedName: "Recorded target billing",
    },
    results: CASES.map((item) => ({
      id: `result-${item.id}`,
      caseId: item.id,
      name: item.name,
      outcome: item.outcome,
      errorSide: null,
      errorDetail: null,
      legacyBody: item.legacyBody,
      modernizedBody: item.modernizedBody,
      diff: item.diff,
    })),
  };
}

function leadership(db: AppDatabase, projectId: string) {
  const project = requireProject(db, projectId);
  const modules = all<{
    id: string;
    name: string;
    kind: string;
    loc: number | null;
    file_status: string | null;
    summary_status: string | null;
    confidence: string | null;
  }>(
    db,
    `SELECT m.id, m.name, m.kind, f.loc, f.status AS file_status, s.status AS summary_status, s.confidence
     FROM modules m
     LEFT JOIN ingested_files f ON f.id = m.file_id
     LEFT JOIN intent_summaries s ON s.module_id = m.id
     WHERE m.project_id = ?`,
    projectId,
  );
  const discrepancies = all<{ module_id: string; rule_id: string; severity: string }>(
    db,
    "SELECT module_id, rule_id, severity FROM discrepancies WHERE project_id = ?",
    projectId,
  );
  const unresolved = all<{ from_module_id: string; to_module_id: string }>(
    db,
    "SELECT from_module_id, to_module_id FROM dependency_edges WHERE project_id = ? AND resolution != 'confirmed'",
    projectId,
  );
  const flagged = one<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM ingested_files WHERE project_id = ? AND status != 'parsed'",
    projectId,
  );
  const files = modules.filter((item) => item.kind === "file");
  const rows = files.map((item) => {
    const findings = discrepancies.filter((row) => row.module_id === item.id);
    const broken = unresolved.some((edge) => edge.from_module_id === item.id || edge.to_module_id === item.id);
    const verified = item.summary_status === "confirmed" || item.summary_status === "corrected";
    let band: "low" | "medium" | "high" | "not_assessed" = "not_assessed";
    if (item.summary_status || findings.length > 0 || broken) {
      if (findings.some((row) => row.severity === "high") || broken) band = "high";
      else if (findings.length > 0 || item.confidence === "low" || item.confidence === "medium") band = "medium";
      else band = "low";
    }
    const reasons: string[] = [];
    if (verified) reasons.push("Intent is confirmed.");
    else if (item.summary_status) reasons.push("Intent is still inferred.");
    else reasons.push("No intent summary is stored.");
    if (findings.length > 0) reasons.push(`Stored findings: ${findings.map((row) => row.rule_id).join(", ")}.`);
    if (broken) reasons.push("An unresolved dependency touches this file.");
    if (item.confidence) reasons.push(`Confidence band ${item.confidence}.`);
    return {
      id: item.id,
      name: item.name.split("/").pop() ?? item.name,
      path: item.name,
      loc: item.loc,
      verified: item.file_status && item.file_status !== "parsed" ? null : verified,
      band,
      reasons,
    };
  });
  const verified = rows.filter((row) => row.verified === true).length;
  const unexamined = rows.filter((row) => row.verified === false).length;
  const notAnalyzable = flagged?.n ?? 0;
  const highRisk = rows.filter((row) => row.band === "high").length;
  const tally = counts();
  const behavior = executionDetail().summary;
  return {
    overview: {
      asOf: project.updated_at,
      narrative: `${project.name}: ${verified} files have confirmed intent, ${unexamined} are still unexamined, and ${notAnalyzable} could not be parsed. High risk marks a stored high-severity finding or an unresolved dependency.`,
      verified,
      unexamined,
      notAnalyzable,
      highRisk,
      rulesLine: `Rule preservation: ${tally.preserved} preserved, ${tally.mentionedOnly} mentioned only, ${tally.distorted} distorted, ${tally.dropped} dropped.`,
      behaviorLine: `Behavior walkthrough: ${behavior.passed} passed and ${behavior.failed} failed in the recorded comparison. No live endpoint was called.`,
    },
    modules: rows,
  };
}

function page<T>(items: T[]) {
  return { items, nextCursor: null, total: items.length };
}

function billingOnly(db: AppDatabase, projectId: string) {
  if (!isLegacyBillingDemo(db, projectId)) {
    throw new HttpError(404, "NOT_FOUND", "The modernization demonstration is prepared for the Legacy Billing sample.");
  }
}

function send(res: Response, next: NextFunction, work: () => unknown) {
  try {
    res.json(work());
  } catch (error) {
    next(error);
  }
}

export function registerBillingDemo(app: Express, db: AppDatabase) {
  app.get("/api/v1/projects/:projectId/architecture/proposals", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    const detail = proposalDetail(db, req.params.projectId);
    return page([{ id: detail.proposal.id, name: detail.proposal.name, status: detail.proposal.status, version: detail.proposal.version }]);
  }));

  app.post("/api/v1/projects/:projectId/architecture/proposals", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    return { proposalId: PROPOSAL_ID, jobId: JOB_ID };
  }));

  app.get("/api/v1/projects/:projectId/architecture/proposals/:proposalId", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    if (req.params.proposalId !== PROPOSAL_ID) throw new HttpError(404, "NOT_FOUND", "That proposal is not in the Legacy Billing demonstration.");
    return proposalDetail(db, req.params.projectId);
  }));

  app.post("/api/v1/projects/:projectId/architecture/proposals/:proposalId/edits", (req: Request, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    const current = edits.get(req.params.projectId);
    const operations = Array.isArray(req.body?.operations) ? req.body.operations as EditOperation[] : [];
    edits.set(req.params.projectId, {
      version: (current?.version ?? 1) + 1,
      note: typeof req.body?.changeNote === "string" ? req.body.changeNote : null,
      operations: [...(current?.operations ?? []), ...operations],
    });
    return proposalDetail(db, req.params.projectId);
  }));

  app.get("/api/v1/projects/:projectId/rules", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    const status = String(req.query.status ?? "");
    const q = String(req.query.q ?? "").toLowerCase();
    const items = RULES.map((rule) => ruleRow(db, req.params.projectId, rule, "accepted")).filter((row) => {
      if (status && status !== "all" && row.status !== status) return false;
      if (q && !`${row.ruleKey} ${row.statement} ${row.moduleName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return page(items);
  }));

  app.get("/api/v1/projects/:projectId/compliance/rules", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    const status = String(req.query.status ?? "");
    const q = String(req.query.q ?? "").toLowerCase();
    const items = RULES.map((rule) => ruleRow(db, req.params.projectId, rule, migrationStatus(db, req.params.projectId, rule))).filter((row) => {
      if (status && status !== "all" && row.status !== status) return false;
      if (q && !`${row.ruleKey} ${row.statement} ${row.moduleName ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return page(items);
  }));

  app.get("/api/v1/projects/:projectId/compliance/rules/:ruleId/trace", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    return ruleTrace(db, req.params.projectId, req.params.ruleId);
  }));

  app.post("/api/v1/projects/:projectId/compliance/rules/:ruleId/decisions", (req: Request, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    const rule = RULES.find((item) => item.id === req.params.ruleId);
    if (!rule) throw new HttpError(404, "NOT_FOUND", "That rule is not in the Legacy Billing demonstration.");
    const status = String(req.body?.status ?? "");
    if (!["preserved", "modified", "removed"].includes(status)) {
      throw new HttpError(400, "VALIDATION", "Status must be preserved, modified, or removed.");
    }
    const justification = typeof req.body?.justification === "string" ? req.body.justification.trim() : "";
    if ((status === "modified" || status === "removed") && justification.length < 20) {
      throw new HttpError(400, "VALIDATION", "Modified or Removed needs a written justification of at least 20 characters.");
    }
    const user = res.locals.user as { display_name?: string } | undefined;
    run(
      db,
      "INSERT INTO demo_rule_decisions (id, project_id, rule_id, status, justification, decided_by, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      randomUUID(),
      req.params.projectId,
      rule.id,
      status,
      justification || null,
      user?.display_name ?? "Demo identity",
      new Date().toISOString(),
    );
    return ruleTrace(db, req.params.projectId, rule.id);
  }));

  app.get("/api/v1/projects/:projectId/rule-checks", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    return page([{ id: CHECK_ID, label: "Legacy Billing target v1", stale: false }]);
  }));

  app.get("/api/v1/projects/:projectId/rule-checks/:runId", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    if (req.params.runId !== CHECK_ID) throw new HttpError(404, "NOT_FOUND", "That rule check is not in the Legacy Billing demonstration.");
    return ruleCheck();
  }));

  app.get("/api/v1/projects/:projectId/test-suites", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    return page([{ id: SUITE_ID, name: "Legacy Billing walkthrough" }]);
  }));

  app.get("/api/v1/projects/:projectId/test-suites/:suiteId", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    if (req.params.suiteId !== SUITE_ID) throw new HttpError(404, "NOT_FOUND", "That suite is not in the Legacy Billing demonstration.");
    return suiteDetail();
  }));

  app.post("/api/v1/projects/:projectId/test-suites/:suiteId/executions", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    if (req.params.suiteId !== SUITE_ID) throw new HttpError(404, "NOT_FOUND", "That suite is not in the Legacy Billing demonstration.");
    return { executionId: EXECUTION_ID, jobId: JOB_ID };
  }));

  app.get("/api/v1/projects/:projectId/executions/:executionId", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    if (req.params.executionId !== EXECUTION_ID) throw new HttpError(404, "NOT_FOUND", "That execution is not in the Legacy Billing demonstration.");
    return executionDetail();
  }));

  app.get("/api/v1/projects/:projectId/leadership/overview", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    return leadership(db, req.params.projectId).overview;
  }));

  app.get("/api/v1/projects/:projectId/leadership/modules", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    const band = String(req.query.band ?? "");
    const q = String(req.query.q ?? "").toLowerCase();
    const sort = String(req.query.sort ?? "risk");
    const dir = String(req.query.dir ?? "desc") === "asc" ? 1 : -1;
    const rank = { high: 3, medium: 2, low: 1, not_assessed: 0 };
    let items = leadership(db, req.params.projectId).modules.filter((row) => {
      if (band && band !== "all" && row.band !== band) return false;
      if (q && !`${row.name} ${row.path ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    items = [...items].sort((left, right) => {
      const value = sort === "name"
        ? left.name.localeCompare(right.name)
        : sort === "size"
          ? (left.loc ?? -1) - (right.loc ?? -1)
          : sort === "verified"
            ? Number(left.verified) - Number(right.verified)
            : rank[left.band] - rank[right.band];
      return value * dir;
    });
    return page(items);
  }));

  app.get("/api/v1/projects/:projectId/jobs/:jobId", (req, res, next) => send(res, next, () => {
    billingOnly(db, req.params.projectId);
    if (req.params.jobId !== JOB_ID) throw new HttpError(404, "NOT_FOUND", "That job is not in the Legacy Billing demonstration.");
    return { id: JOB_ID, status: "complete", error: null };
  }));
}
