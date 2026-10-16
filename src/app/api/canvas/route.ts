// Turns a natural-language request into a canvas workflow (blocks + edges + per-block settings).
import { complete, extractJson } from "@/harness/llm";
import { BLOCK_FIELDS } from "@/components/blockConfig";

const KINDS: Record<string, string> = {
  "trigger.form": "Form submit", "trigger.schedule": "Schedule", "trigger.webhook": "Webhook",
  "app.slack": "Slack", "app.gmail": "Gmail", "app.calendar": "Calendar", "app.twilio": "Twilio SMS", "app.stripe": "Stripe", "app.hubspot": "HubSpot", "app.jira": "Jira",
  "ai.agent": "LLM agent", "ai.memory": "Agent Memory", "ai.graph": "Company graph", "ai.sandbox": "Daytona sandbox", "ai.browser": "Anchor browser",
  "logic.approval": "Approval", "logic.branch": "Branch", "ui.app": "Internal tool UI",
};

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const catalog = Object.entries(KINDS).map(([k, label]) => `${k} (${label}; settings: ${(BLOCK_FIELDS[k] ?? []).map((f) => f.key + (f.options ? `=${f.options.join("|")}` : "")).join(", ")})`).join("\n");
  let g: { nodes: any[]; edges: any[] } = { nodes: [], edges: [] }; let model = "";
  for (let attempt = 0; attempt < 2 && !g.nodes?.length; attempt++) {
  const r = await complete("fast", [
    { role: "system", content: `You turn a request into a workflow graph for an enterprise automation canvas. Use ONLY these block kinds:\n${catalog}\nReturn ONLY JSON: {"nodes":[{"id":"n1","kind":"trigger.form","label":"short label","note":"what this step does, one line","config":{"settingKey":"value"}}],"edges":[{"source":"n1","target":"n2"}]}. 4-8 nodes, start with a trigger, end with an output (ui.app or an app). Fill config with concrete values from the request (for select settings use one of the listed options). Include ai.memory or ai.graph when company context helps, and ai.sandbox whenever code is executed.` },
    { role: "user", content: String(prompt).slice(0, 2000) },
  ], { json: true, maxTokens: 3000 });
  try { g = extractJson<{ nodes: any[]; edges: any[] }>(r.text); model = `${r.provider}/${r.model}`; } catch { /* retry */ }
  }
  const nodes = (g.nodes ?? []).filter((n) => KINDS[n.kind]).slice(0, 10);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = (g.edges ?? []).filter((e) => ids.has(e.source) && ids.has(e.target));
  // Layered layout: column = longest path from a root.
  const level: Record<string, number> = {}; nodes.forEach((n) => (level[n.id] = 0));
  for (let i = 0; i < nodes.length; i++) for (const e of edges) level[e.target] = Math.max(level[e.target], level[e.source] + 1);
  const rows: Record<number, number> = {};
  const placed = nodes.map((n) => {
    const col = level[n.id]; const row = (rows[col] = (rows[col] ?? -1) + 1);
    return { id: n.id, type: "block", position: { x: 40 + col * 280, y: 60 + row * 170 }, data: { kind: n.kind, label: n.label || KINDS[n.kind], note: n.note, config: n.config ?? {} } };
  });
  return Response.json({ nodes: placed, edges: edges.map((e, i) => ({ id: `e${i}`, source: e.source, target: e.target, animated: true })), model });
}
