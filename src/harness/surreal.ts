// SurrealDB access: HTTP /sql for queries (stateless, robust), WebSocket SDK for LIVE SELECT.
import { Surreal, Table } from "surrealdb";
import { env, surrealHttpBase } from "@/lib/env";

type StmtResult = { status: "OK" | "ERR"; result: unknown; time?: string };

export async function sql<T = unknown[]>(query: string, vars: Record<string, unknown> = {}, opts: { ns?: string; db?: string; token?: string } = {}): Promise<T> {
  const base = surrealHttpBase();
  if (!base) throw new Error("SURREAL_URL not set");
  // Bind params with LET prefixes: JSON literals are valid SurrealQL values.
  const entries = Object.entries(vars).filter(([, v]) => v !== undefined);
  const prefix = entries.map(([k, v]) => `LET $${k} = ${JSON.stringify(v)};`).join("\n");
  const res = await fetch(`${base}/sql`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "text/plain",
      "Surreal-NS": opts.ns ?? env.surrealNs,
      "Surreal-DB": opts.db ?? env.surrealDb,
      Authorization: opts.token ? `Bearer ${opts.token}` : "Basic " + Buffer.from(`${env.surrealUser}:${env.surrealPass}`).toString("base64"),
    },
    body: prefix ? prefix + "\n" + query : query,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SurrealDB ${res.status}: ${text.slice(0, 400)}`);
  const parsed = JSON.parse(text) as StmtResult[];
  const err = parsed.find((s) => s.status === "ERR");
  if (err) throw new Error(`SurrealQL error: ${String(err.result).slice(0, 400)}`);
  return parsed.slice(entries.length).map((s) => s.result) as T;
}

/** Return result of the last statement. */
export async function sqlOne<T = unknown>(query: string, vars: Record<string, unknown> = {}, opts?: { ns?: string; db?: string }): Promise<T> {
  const r = await sql<unknown[]>(query, vars, opts);
  return r[r.length - 1] as T;
}

// ---------- WebSocket client for LIVE SELECT ----------
let ws: Surreal | null = null;
let wsReady: Promise<Surreal> | null = null;
export function liveClient(): Promise<Surreal> {
  if (wsReady) return wsReady;
  wsReady = (async () => {
    ws = new Surreal();
    const url = env.surrealUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
    await ws.connect(url.endsWith("/rpc") ? url : url + "/rpc", {
      namespace: env.surrealNs,
      database: env.surrealDb,
      authentication: { username: env.surrealUser, password: env.surrealPass },
    });
    return ws;
  })().catch((e) => { wsReady = null; throw e; });
  return wsReady;
}

export async function liveTable(table: string, onMsg: (action: string, value: Record<string, unknown>) => void): Promise<() => void> {
  const db = await liveClient();
  const sub = await db.live(new Table(table));
  const unsub = sub.subscribe((m) => { if (m.action !== "KILLED") onMsg(m.action, m.value as Record<string, unknown>); });
  return () => { try { unsub(); sub.kill?.(); } catch { /* ignore */ } };
}

export function rid(v: unknown): string {
  return typeof v === "string" ? v : String(v);
}
