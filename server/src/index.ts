import path from "node:path";
import { openDatabase, openPostgres } from "./db.js";
import { createApp } from "./app.js";

const postgresUrl = process.env.DATABASE_URL || "postgres://postgres:molt@127.0.0.1:55432/molt";
const db = process.env.MOLT_DB_PATH ? openDatabase(path.resolve(process.env.MOLT_DB_PATH)) : openPostgres(postgresUrl);
const { app } = createApp(db);
const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`MoltProtocol API listening on http://localhost:${port}`);
});
