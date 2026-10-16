// SurrealDB Agent Memory client (REST). Three layers:
//  - Episodic  : sessions + turns (what happened)            -> /sessions, /facts with session_id
//  - Semantic  : extracted facts that SUPERSEDE, tri-temporal -> /facts infer=full, /entities/.../history
//  - Procedural: instructions/recipes that worked             -> /facts tagged procedure + harness `procedure` table
// All agents share one Context; each writes to its own scope and reads through lenses.
import { env } from "@/lib/env";

export const SCOPES = {
  org: () => `org/${env.org}`,
  agent: (a: string) => `org/${env.org}/agent/${a}`,
  tool: (t: string) => `org/${env.org}/tool/${t}`,
  procedures: () => `org/${env.org}/procedures`,
};

export function memoryEnabled() { return !!(env.memUrl && env.memCtx && env.memKey); }

async function call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${env.memUrl}/api/v1/${env.memCtx}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.memKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`AgentMemory ${method} ${path} ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text) as T; } catch { return text as T; }
}

export const memory = {
  me: () => call("GET", "/me"),
  async ensureScopes(paths: string[]) {
    for (const path of paths) {
      try { await call("POST", "/scopes", { path }); }
      catch (e) {
        const m = (e as Error).message;
        if (!/409|exist/i.test(m)) { try { await call("POST", "/scopes", { scope: path }); } catch { /* best effort */ } }
      }
    }
  },
  /** Semantic: remember a fact. Supersession happens server-side (same entity+key+scope). */
  remember: (text: string, scope: string, extra: Record<string, unknown> = {}) =>
    call("POST", "/facts", { text, infer: "full", scopes: [[scope]], ...extra }),
  /** Episodic: open a session for one harness run. */
  openSession: async (scope: string, metadata: Record<string, unknown>) => {
    const r = await call<any>("POST", "/sessions", { scopes: [[scope]], metadata });
    return (r.sessionId ?? r.id ?? r.session_id) as string;
  },
  /** Episodic: append a turn (agent message) to the run's session. */
  turn: (sessionId: string, role: "user" | "assistant", text: string, scope: string, infer: "none" | "full" = "none") =>
    call("POST", "/facts", { text, infer, scopes: [[scope]], session_id: sessionId, role }),
  /** Recall LLM-ready context through a lens (one or many scopes = OR). */
  context: (query: string, lens: string[], k = 10) =>
    call<{ context: string; tier: string; queryMs: number; trace?: { traceId?: string } }>("POST", "/context", { query, lens, k }),
  /** Ranked recall with trace id (provenance). */
  query: (query: string, lens: string[], k = 10, asOf?: string) =>
    call<any>("POST", "/query", { query, lens, k, ...(asOf ? { asOf } : {}), source: "vibeflow-harness" }),
  trace: (id: string) => call("GET", `/traces/${encodeURIComponent(id)}`),
  history: (type: string, name: string, key?: string) =>
    call("GET", `/entities/${encodeURIComponent(type)}/${encodeURIComponent(name)}/history${key ? "/" + encodeURIComponent(key) : ""}`),
  entities: (q: string) => call("GET", `/entities/search?q=${encodeURIComponent(q)}&limit=20`),
  attributes: () => call("GET", `/attributes?limit=50`),
  turns: (sessionId: string) => call("GET", `/sessions/${sessionId}/turns?limit=200`),
  uncertainty: () => call("GET", `/uncertainty`).catch(() => null),
  traces: () => call("GET", `/traces?limit=20`),
};
