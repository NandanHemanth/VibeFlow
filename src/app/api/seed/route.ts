import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "@/harness/surreal";
import { seedAcme } from "@/harness/kg";
import { memory, memoryEnabled, SCOPES } from "@/harness/memory";

export async function POST() {
  const schema = await readFile(path.join(process.cwd(), "src/harness/schema.surql"), "utf8");
  const ns = process.env.SURREAL_NS ?? "vibeflow", db = process.env.SURREAL_DB ?? "harness";
  await sql(`DEFINE NAMESPACE IF NOT EXISTS ${ns}; USE NS ${ns}; DEFINE DATABASE IF NOT EXISTS ${db};`).catch(() => {});
  await sql(schema);
  await seedAcme();
  let mem = "skipped";
  const seeded = await sql<any[]>(`SELECT * FROM ONLY meta:memory_seeded_v2`).then((r) => r[0]).catch(() => null);
  if (memoryEnabled() && !seeded) {
    await memory.ensureScopes([SCOPES.org(), SCOPES.procedures()]);
    // observed_at sets known-time, so asOf recall and the supersession chain reflect when Acme actually learned each fact.
    const facts: [string, string?][] = [
      ["Acme Robotics' discount approval policy: Account Executives approve discounts up to 10%, Sales Managers up to 20%, and VP Sales Maya Chen approves anything above 20%.", "2026-07-01T09:00:00Z"],
      ["Acme Robotics' discount approval policy changed effective October 1 2026: Account Executives approve up to 10%, Sales Managers up to 15%, VP Sales Maya Chen up to 25%, and any discount above 25% requires CFO David Kim. The margin floor is 55%.", "2026-10-01T09:00:00Z"],
      ["Acme Robotics' sales pipeline stages are Lead, Qualified, Demo, Proposal, Legal Review, Closed Won, Closed Lost.", "2026-10-02T09:00:00Z"],
      ["At Acme Robotics, Raj Patel reports to Jordan Lee; Lena Ortiz and Tom Becker report to Kofi Mensah; both Sales Managers report to VP Sales Maya Chen, who reports to CEO Priya Raman. CFO David Kim also reports to Priya Raman.", "2026-09-01T09:00:00Z"],
      ["Hooli Devices is an at-risk Acme Robotics account: two open P1 tickets, and SVP Gavin Belson threatened to pause the rollout unless calibration drift is fixed.", "2026-10-09T17:30:00Z"],
      ["Acme Robotics deal desk rule: every discount request must include deal value, discount percent, written justification and the requesting AE, and every decision is logged for audit.", "2026-10-01T09:00:00Z"],
      ["Acme Robotics' brand primary colour is indigo #4F46E5 and internal tools should feel crisp and enterprise.", "2026-08-01T09:00:00Z"],
    ];
    for (const [f, at] of facts) await memory.remember(f, SCOPES.org(), at ? { observed_at: at } : {}).catch(() => {});
    mem = `${facts.length} dated facts`;
    await sql(`UPSERT meta:memory_seeded_v2 SET at = time::now()`).catch(() => {});
  }
  else if (seeded) mem = "already seeded (facts are not re-asserted, so supersessions stick)";
  return Response.json({ ok: true, memory: mem });
}
