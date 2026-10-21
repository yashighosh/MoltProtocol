import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { all, one, run, type AppDatabase } from "./db.js";
import { buildGraphSvg, buildPdf } from "./export/graphExport.js";
import { errorBody, HttpError } from "./http.js";
import { verifyPassword } from "./passwords.js";
import {
  confirmSummary,
  correctSummary,
  discrepancyPayload,
  fileSource,
  graphPayload,
  kick,
  listProjects,
  moduleDetail,
  projectPayload,
  queueAnalysis,
  queueDiscrepancies,
  queueForReview,
  queueSummaries,
  repositoryRoot,
  retryIngestion,
  reviewQueue,
  setDiscrepancyStatus,
  startGitProject,
  startSampleProject,
  startUploadProject,
  summariesPayload,
  summaryDetail,
} from "./pipeline.js";
import { dashboardPayload, traceabilityPayload } from "./readModels.js";
import { readZip } from "./ingest/zipSafe.js";
import { SUPPORTED_LANGUAGE_NOTE } from "./ingest/classify.js";

type UserRow = { id: string; email: string; display_name: string; password_hash: string; is_demo: number };

function publicUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    isDemo: user.is_demo === 1,
    identityLabel: user.is_demo === 1 ? "Demo identity" : "Signed-in identity",
  };
}

function tokenFrom(req: Request): string | undefined {
  const header = req.header("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  const cookie = req.cookies?.molt_session;
  return typeof cookie === "string" ? cookie : undefined;
}

function userFrom(db: AppDatabase, req: Request): UserRow | undefined {
  const token = tokenFrom(req);
  if (!token) return undefined;
  return one<UserRow>(
    db,
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    token,
    new Date().toISOString(),
  );
}

export function createApp(db: AppDatabase, options: { maxUploadBytes?: number } = {}) {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options.maxUploadBytes ?? 20 * 1024 * 1024, files: 200 },
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true, service: "moltprotocol", demonstrationMode: process.env.MOLT_LLM_ENABLED !== "true" });
  });

  app.post("/api/v1/auth/login", (req, res, next) => {
    try {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const password = String(req.body?.password ?? "");
      if (!email || !password) {
        throw new HttpError(400, "VALIDATION", "Email and password are required.", {
          email: email ? "" : "Enter the demo email.",
          password: password ? "" : "Enter the demo password.",
        });
      }
      const user = one<UserRow>(db, "SELECT * FROM users WHERE email = ?", email);
      if (!user) throw new HttpError(401, "UNKNOWN_IDENTITY", "No demo identity matches that email.");
      if (!verifyPassword(password, user.password_hash)) {
        throw new HttpError(401, "BAD_PASSWORD", "Password does not match this demo identity.");
      }
      const token = randomUUID();
      const created = new Date();
      const expires = new Date(created.getTime() + 7 * 24 * 3600 * 1000);
      run(db, "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", token, user.id, created.toISOString(), expires.toISOString());
      res.cookie("molt_session", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600 * 1000 });
      res.json({ token, user: publicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/auth/logout", (req, res) => {
    const token = tokenFrom(req);
    if (token) run(db, "DELETE FROM sessions WHERE token = ?", token);
    res.clearCookie("molt_session", { path: "/" });
    res.json({ ok: true });
  });

  app.get("/api/v1/auth/me", (req, res) => {
    const user = userFrom(db, req);
    if (!user) {
      res.status(401).json(errorBody(new HttpError(401, "UNAUTHENTICATED", "Sign in is required.")));
      return;
    }
    res.json({ user: publicUser(user) });
  });

  app.use("/api/v1", (req, res, next) => {
    const user = userFrom(db, req);
    if (!user) {
      next(new HttpError(401, "UNAUTHENTICATED", "Sign in is required."));
      return;
    }
    res.locals.user = user;
    next();
  });

  app.get("/api/v1/meta", (_req, res) => {
    res.json({
      supportedLanguages: SUPPORTED_LANGUAGE_NOTE,
      gitHosts: ["github.com", "gitlab.com", "bitbucket.org"],
      discrepancyRule: "Detection runs only after an expert confirms or corrects the intent. Unreviewed summaries are excluded and reported.",
      persistence: "SQLite job table with status polling. Redis and BullMQ are not used in this sprint.",
      identity: "Demo identity. Accounts are persisted local users, not an enterprise directory.",
    });
  });

  app.get("/api/v1/projects", (_req, res) => {
    res.json({ projects: listProjects(db) });
  });

  app.get("/api/v1/dashboard", (req, res, next) => {
    try {
      const projectId = typeof req.query.projectId === "string" && req.query.projectId ? req.query.projectId : undefined;
      res.json(dashboardPayload(db, projectId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/projects/upload", upload.fields([{ name: "archive", maxCount: 1 }, { name: "files", maxCount: 200 }]), (req, res, next) => {
    try {
      const name = String(req.body?.name ?? "");
      const groups = req.files as { archive?: Express.Multer.File[]; files?: Express.Multer.File[] } | undefined;
      const archive = groups?.archive?.[0];
      const loose = groups?.files ?? [];
      if (!archive && loose.length === 0) {
        throw new HttpError(400, "VALIDATION", "Choose a zip archive or at least one source file.", { files: "Nothing was uploaded." });
      }
      let collected: { path: string; bytes: Buffer }[] = [];
      let preflightError: string | undefined;
      if (archive) {
        const unzipped = readZip(archive.buffer);
        if ("error" in unzipped) preflightError = unzipped.error;
        else collected = unzipped.files;
      }
      for (const file of loose) {
        collected.push({ path: file.originalname.replace(/\\/g, "/"), bytes: file.buffer });
      }
      const projectId = startUploadProject(db, {
        name,
        userId: res.locals.user.id,
        files: collected,
        preflightError,
        sourceRef: archive?.originalname || loose.map((file) => file.originalname).join(", "),
      });
      res.status(202).json({ projectId });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/projects/git", (req, res, next) => {
    try {
      const projectId = startGitProject(db, { name: String(req.body?.name ?? ""), userId: res.locals.user.id, url: String(req.body?.url ?? "") });
      res.status(202).json({ projectId });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/projects/sample", (req, res, next) => {
    try {
      const projectId = startSampleProject(db, { name: String(req.body?.name ?? "Sample legacy billing"), userId: res.locals.user.id });
      res.status(202).json({ projectId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/projects/:projectId", (req, res, next) => {
    try {
      res.json(projectPayload(db, req.params.projectId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/projects/:projectId/retry", (req, res, next) => {
    try {
      retryIngestion(db, req.params.projectId);
      res.status(202).json({ projectId: req.params.projectId });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/projects/:projectId/dependency-analysis", (req, res, next) => {
    try {
      queueAnalysis(db, req.params.projectId);
      res.status(202).json({ projectId: req.params.projectId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/projects/:projectId/graph", (req, res, next) => {
    try {
      res.json(graphPayload(db, req.params.projectId));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/projects/:projectId/graph.svg", (req, res, next) => {
    try {
      const graph = graphPayload(db, req.params.projectId);
      res.type("image/svg+xml").send(buildGraphSvg(graph.nodes, graph.edges));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/projects/:projectId/graph.pdf", (req, res, next) => {
    try {
      const graph = graphPayload(db, req.params.projectId);
      const lines = [
        `MoltProtocol dependency map — ${graph.nodes.length} modules, ${graph.edges.length} edges`,
        "Solid relationships are confirmed inside this ingest. Unresolved means the target file or package is not present.",
        ...graph.nodes.map((node) => `Module ${node.name} (${node.kind})`),
        ...graph.edges.map((edge) => {
          const from = graph.nodes.find((node) => node.id === edge.from)?.name ?? edge.from;
          const to = graph.nodes.find((node) => node.id === edge.to)?.name ?? edge.to;
          return `${edge.resolution} ${edge.relationship}: ${from} -> ${to}`;
        }),
      ];
      const pdf = buildPdf(lines);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=dependency-map.pdf");
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/projects/:projectId/modules/:moduleId", (req, res, next) => {
    try {
      res.json(moduleDetail(db, req.params.projectId, req.params.moduleId));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/projects/:projectId/files/source", (req, res, next) => {
    try {
      res.json(fileSource(db, req.params.projectId, String(req.query.path ?? "")));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/projects/:projectId/summaries/generate", (req, res, next) => {
    try {
      queueSummaries(db, req.params.projectId);
      res.status(202).json({ projectId: req.params.projectId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/projects/:projectId/summaries", (req, res, next) => {
    try {
      res.json(summariesPayload(db, req.params.projectId));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/summaries/:summaryId", (req, res, next) => {
    try {
      res.json(summaryDetail(db, req.params.summaryId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/summaries/:summaryId/queue", (req, res, next) => {
    try {
      const projectId = queueForReview(db, req.params.summaryId, res.locals.user.id);
      res.json({ projectId, summary: summaryDetail(db, req.params.summaryId) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/summaries/:summaryId/confirm", (req, res, next) => {
    try {
      confirmSummary(db, req.params.summaryId, res.locals.user.id);
      res.json(summaryDetail(db, req.params.summaryId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/summaries/:summaryId/correct", (req, res, next) => {
    try {
      correctSummary(db, req.params.summaryId, res.locals.user.id, String(req.body?.text ?? ""), Boolean(req.body?.acknowledgeOverride));
      res.json(summaryDetail(db, req.params.summaryId));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/projects/:projectId/reviews", (req, res, next) => {
    try {
      res.json({ reviews: reviewQueue(db, req.params.projectId) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/projects/:projectId/discrepancies/detect", (req, res, next) => {
    try {
      queueDiscrepancies(db, req.params.projectId);
      res.status(202).json({ projectId: req.params.projectId });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/projects/:projectId/traceability", (req, res, next) => {
    try {
      res.json(traceabilityPayload(db, req.params.projectId));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/projects/:projectId/discrepancies", (req, res, next) => {
    try {
      res.json(discrepancyPayload(db, req.params.projectId));
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/v1/discrepancies/:id", (req, res, next) => {
    try {
      setDiscrepancyStatus(db, req.params.id, String(req.body?.status ?? ""));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", (req, res) => {
    res.status(404).json(errorBody(new HttpError(404, "NOT_FOUND", `No API route matches ${req.method} ${req.path}.`)));
  });

  const dist = path.join(repositoryRoot(), "client", "dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE" ? "File exceeds the upload size limit." : error.message;
      res.status(400).json(errorBody(new HttpError(400, "UPLOAD_REJECTED", message)));
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json(errorBody(error));
      return;
    }
    const message = error instanceof Error ? error.message : "Unexpected server error";
    console.error(`MoltProtocol request error: ${message}`);
    res.status(500).json(errorBody(new HttpError(500, "INTERNAL", "The server could not complete this request.")));
  });

  return { app, db, done: () => kick(db) };
}

export { all };
