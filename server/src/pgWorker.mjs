import { parentPort } from "node:worker_threads";
import pg from "pg";

pg.types.setTypeParser(20, (value) => Number(value));

let client = null;

function reply(message, body) {
  const lock = new Int32Array(message.lock);
  message.port.postMessage(body);
  Atomics.store(lock, 0, 1);
  Atomics.notify(lock, 0);
}

parentPort.on("message", async (message) => {
  try {
    if (message.type === "connect") {
      client = new pg.Client({ connectionString: message.connectionString });
      await client.connect();
      reply(message, { rows: [] });
      return;
    }
    if (!client) throw new Error("PostgreSQL is not connected");
    const result = await client.query(message.sql, message.params);
    reply(message, { rows: result.rows });
  } catch (error) {
    reply(message, { error: error instanceof Error ? error.message : String(error) });
  }
});
