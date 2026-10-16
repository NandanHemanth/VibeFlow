// Tiny runtime: serves the built tool + proxies SQL to this tool's own SurrealDB.
// Default: embedded SurrealDB inside the sandbox (127.0.0.1:8000, no egress needed).
// Cloud mode: SURREAL_TOKEN is a Daytona Secret placeholder swapped in by Daytona's egress proxy.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
const PORT = Number(process.env.PORT || 3000);
const DIST = join(process.cwd(), "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
const base = (process.env.SURREAL_HTTP || "http://127.0.0.1:8000").replace(/\/$/, "");
const auth = process.env.SURREAL_PASS
  ? "Basic " + Buffer.from(`${process.env.SURREAL_USER || "root"}:${process.env.SURREAL_PASS}`).toString("base64")
  : `Bearer ${process.env.SURREAL_TOKEN}`;
export async function surreal(sql, vars) {
  const lets = Object.entries(vars || {}).map(([k, v]) => `LET $${k} = ${JSON.stringify(v)};`);
  const r = await fetch(`${base}/sql`, { method: "POST", headers: {
    Accept: "application/json", "Content-Type": "text/plain",
    "Surreal-NS": process.env.SURREAL_NS || "vibeflow", "Surreal-DB": process.env.SURREAL_DB || "tool", Authorization: auth }, body: lets.join("\n") + "\n" + sql });
  const out = await r.json();
  if (!r.ok || !Array.isArray(out)) throw new Error(JSON.stringify(out).slice(0, 300));
  const stmts = out.slice(lets.length);
  const err = stmts.find((s) => s.status === "ERR");
  if (err) throw new Error(String(err.result));
  return stmts[stmts.length - 1]?.result;
}
if (process.argv[2] !== "--lib") http.createServer(async (req, res) => {
  try {
    if (req.url === "/api/health") { res.writeHead(200, { "content-type": "application/json" }); return res.end('{"ok":true}'); }
    if (req.url === "/api/sql" && req.method === "POST") {
      let body = ""; for await (const c of req) body += c;
      const { sql, vars } = JSON.parse(body || "{}");
      try { const result = await surreal(sql, vars); res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ result })); }
      catch (e) { res.writeHead(400, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: String(e.message || e) })); }
    }
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = join(DIST, p === "/" ? "index.html" : p);
    try { if (!(await stat(file)).isFile()) file = join(DIST, "index.html"); } catch { file = join(DIST, "index.html"); }
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }); res.end(data);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(PORT, "0.0.0.0", () => console.log("vibeflow tool on", PORT));
