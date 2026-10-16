// Memory explorer: episodic (episodes + Agent Memory sessions), semantic (live attributes + history), procedural.
import { sqlOne } from "@/harness/surreal";
import { memory, memoryEnabled } from "@/harness/memory";
 
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = u.searchParams.get("q");
  const out: any = { enabled: memoryEnabled() };
  out.episodes = await sqlOne<any[]>(`SELECT * FROM episode ORDER BY at DESC LIMIT 25`).catch(() => []);
  out.procedures = await sqlOne<any[]>(`SELECT *, <-built_with<-tool.command AS used_by FROM procedure ORDER BY score DESC`).catch(() => []);
  out.cache = await sqlOne<any[]>(`SELECT id, prompt, expires FROM cache ORDER BY expires DESC LIMIT 10`).catch(() => []);
  if (memoryEnabled()) {
    out.attributes = await memory.attributes().catch((e) => ({ error: e.message }));
    out.traces = await memory.traces().catch(() => null);
    if (q) out.recall = await memory.query(q, [`org/${process.env.VF_ORG ?? "acme"}`], 10, u.searchParams.get("asOf") ?? undefined).catch((e) => ({ error: e.message }));
    const ent = u.searchParams.get("entity");
    if (ent) { const [type, name] = ent.split(":"); out.history = await memory.history(type, name, u.searchParams.get("key") ?? undefined).catch((e) => ({ error: e.message })); }
  }
  return Response.json(out);
}
