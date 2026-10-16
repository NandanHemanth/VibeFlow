// Applies schema + seed rows to this tool's database. Run after SurrealDB is up.
import { readFile } from "node:fs/promises";
const ns = process.env.SURREAL_NS || "vibeflow", db = process.env.SURREAL_DB || "tool";
const auth = "Basic " + Buffer.from(`${process.env.SURREAL_USER || "root"}:${process.env.SURREAL_PASS}`).toString("base64");
const base = (process.env.SURREAL_HTTP || "http://127.0.0.1:8000").replace(/\/$/, "");
const run = async (sql, headers = {}) => { const r = await fetch(`${base}/sql`, { method: "POST", headers: { Accept: "application/json", Authorization: auth, ...headers }, body: sql }); const j = await r.json(); const e = Array.isArray(j) ? j.find((s) => s.status === "ERR") : j; if (e) throw new Error(JSON.stringify(e).slice(0, 300)); return j; };
await run(`DEFINE NAMESPACE IF NOT EXISTS ${ns}; USE NS ${ns}; DEFINE DATABASE IF NOT EXISTS ${db};`);
const raw = JSON.parse(await readFile("seed.json", "utf8"));
const seed = raw.rows ?? raw;
const tables = [...new Set([...(raw.tables ?? []), ...Object.keys(seed)])].filter((t) => /^[a-z_][a-z0-9_]*$/i.test(t));
await run(tables.map((t) => `DEFINE TABLE IF NOT EXISTS ${t} SCHEMALESS;`).join("\n") || "RETURN 1;", { "Surreal-NS": ns, "Surreal-DB": db });
for (const [table, rows] of Object.entries(seed)) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) continue;
  const clean = (Array.isArray(rows) ? rows : []).map(({ id, ...r }) => r);
  await run(`DELETE ${table}; INSERT INTO ${table} ${JSON.stringify(clean)};`, { "Surreal-NS": ns, "Surreal-DB": db });
  console.log("seeded", table, clean.length);
}
