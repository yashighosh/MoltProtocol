import path from "node:path";
import { openDatabase } from "./db.js";
import { createApp } from "./app.js";
import { repositoryRoot } from "./pipeline.js";

const databasePath = process.env.MOLT_DB_PATH || path.join(repositoryRoot(), "data", "molt.sqlite");
const db = openDatabase(databasePath);
const { app } = createApp(db);
const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`MoltProtocol API listening on http://localhost:${port}`);
});
