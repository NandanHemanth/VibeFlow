// Data access for VibeFlow tools. All data lives in this tool's own SurrealDB database.
// The sandbox never sees the DB credential: Daytona Secrets swap it in at the egress proxy.
export async function q<T = any>(sql: string, vars: Record<string, unknown> = {}): Promise<T[]> {
  const r = await fetch("/api/sql", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sql, vars }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "query failed");
  return (Array.isArray(j.result) ? j.result : j.result == null ? [] : [j.result]) as T[];
}
export const db = {
  list: <T = any>(table: string, order = "") => q<T>(`SELECT * FROM type::table($t) ${order}`, { t: table }),
  create: <T = any>(table: string, data: Record<string, unknown>) => q<T>(`CREATE type::table($t) CONTENT $d`, { t: table, d: data }),
  merge: <T = any>(id: string, data: Record<string, unknown>) => q<T>(`UPDATE type::record($id) MERGE $d`, { id, d: data }),
  remove: (id: string) => q(`DELETE type::record($id)`, { id }),
};
export async function companyContext(): Promise<any> { return (await fetch("/context.json")).json(); }
