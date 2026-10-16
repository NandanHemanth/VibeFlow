// Policy simulation, inspired by MiroFish (github.com/666ghj/MiroFish): seed a small world from the company graph,
// let persona agents act against the new tool + current policies for a few rounds, then a report agent predicts
// outcomes and flags policy friction. Runs in the harness (tool sandboxes have no egress) and its report is
// written to episodic memory so the next build can learn from it.
import { complete, extractJson } from "./llm";

async function jsonCall<T>(sys: string, user: string, maxTokens: number): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await complete("fast", [{ role: "system", content: sys + (attempt ? " Keep every string under 160 characters." : "") }, { role: "user", content: user }], { json: true, maxTokens, temperature: attempt ? 0.3 : 0.7 });
      return extractJson<T>(r.text);
    } catch { /* retry once */ }
  }
  return null;
}

export type SimReport = {
  summary: string; rounds: { round: number; events: { actor: string; action: string; outcome: string }[] }[];
  predictions: string[]; risks: string[]; policy_findings: string[]; recommendations: string[];
  metrics: Record<string, string | number>;
};

export async function simulate(opts: { toolName: string; command: string; spec: unknown; kg: Record<string, any[]>; rounds?: number; onRound?: (n: number, events: number) => void }): Promise<SimReport> {
  const people = (opts.kg.kg_people ?? []).map((p: any) => `${p.name} (${p.title}, reports to ${p.manager ?? "board"}, approval limit ${p.approval_limit_pct ?? "-"}%)`);
  const customers = (opts.kg.kg_accounts ?? []).flatMap((a: any) => (a.contacts ?? []).map((c: any) => `${c.name} (${c.title}, ${a.name}, ${c.role}; account health ${a.health})`));
  const world = `TOOL: ${opts.toolName} (${opts.command})\nSPEC: ${JSON.stringify(opts.spec).slice(0, 3000)}\nPOLICIES: ${JSON.stringify(opts.kg.kg_policies ?? [])}\nOPPORTUNITIES: ${JSON.stringify(opts.kg.kg_deals ?? [])}\nPAST DECISIONS: ${JSON.stringify(opts.kg.kg_approvals ?? [])}\nOPEN TICKETS: ${JSON.stringify(opts.kg.kg_tickets ?? [])}\nINTERNAL PERSONAS: ${people.join("; ")}\nCUSTOMER PERSONAS: ${customers.join("; ")}`;
  const rounds: SimReport["rounds"] = [];
  const n = opts.rounds ?? 3;
  for (let i = 1; i <= n; i++) {
    const res = await jsonCall<{ events: SimReport["rounds"][0]["events"] }>(
      "You run a multi-agent social simulation of a company adopting a new internal tool. Each persona acts in character, following (or pushing against) the company's current policies. Be concrete: name people, deals, amounts, percentages. Return ONLY JSON: {\"events\":[{\"actor\":\"name (title)\",\"action\":\"what they do in or around the tool\",\"outcome\":\"what happens, including policy effects\"}]} with 5-7 events.",
      `${world}\n\nPREVIOUS ROUNDS: ${JSON.stringify(rounds).slice(0, 4000)}\n\nSimulate round ${i} of ${n} (round ${i} = week ${i} after launch). Let earlier outcomes drive reactions (escalations, workarounds, customer pressure).`, 4000);
    const ev = res?.events ?? [];
    rounds.push({ round: i, events: ev.slice(0, 8) });
    opts.onRound?.(i, ev.length);
  }
  const report = await jsonCall<Omit<SimReport, "rounds">>(
    "You are the REPORT agent. From the simulation log, write a strategy and prediction report for the tool's owner. Return ONLY JSON: {\"summary\":\"2 sentences\",\"predictions\":[3-4 measurable predictions for the next quarter],\"risks\":[2-4],\"policy_findings\":[2-4 places where current policy creates friction, loopholes or bottlenecks, naming the policy],\"recommendations\":[3 concrete changes to the tool or policy],\"metrics\":{\"approvals_simulated\":n,\"escalations\":n,\"policy_violations_blocked\":n,\"median_cycle_time\":\"..\"}}",
    `${world}\n\nSIMULATION LOG: ${JSON.stringify(rounds)}`, 4000);
  if (!report) throw new Error("report agent returned no valid JSON");
  // Models sometimes return objects instead of strings; flatten for display and memory.
  const flat = (xs: unknown) => (Array.isArray(xs) ? xs : []).map((x) => typeof x === "string" ? x : x && typeof x === "object" ? Object.values(x as object).map(String).join(": ") : String(x));
  return { ...report, predictions: flat(report.predictions), risks: flat(report.risks), policy_findings: flat(report.policy_findings), recommendations: flat(report.recommendations), rounds };
}
