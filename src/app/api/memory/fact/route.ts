// Write a new fact. If it conflicts with an existing one (same entity/key/scope) Agent Memory SUPERSEDES it:
// the old value is closed with valid_until, the new opens with valid_from — nothing is overwritten.
import { memory, SCOPES } from "@/harness/memory";
import { sql } from "@/harness/surreal";

export async function POST(req: Request) {
  const { text, policy } = await req.json();
  const r = await memory.remember(String(text), SCOPES.org());
  if (policy) await sql(`UPDATE policy:pipeline MERGE $p`, { p: policy }).catch(() => {});
  // A superseded fact invalidates cached plans built on the old belief.
  await sql(`UPDATE cache SET expires = time::now() WHERE expires > time::now(); CREATE episode SET kind = "fact_superseded", summary = $t, source = "agent-memory";`, { t: `Fact changed: ${String(text).slice(0, 160)} (semantic cache invalidated)` }).catch(() => {});
  return Response.json(r);
}
