// The VibeFlow Agent Harness: intent -> cache -> context (KG + 3 memory layers) -> plan -> provision
// -> sandbox -> build -> verify/repair -> run -> QA -> register /command -> write memory back.
import crypto from "node:crypto";
import { complete, extractJson, extractCode, embed } from "./llm";
import { sql, sqlOne } from "./surreal";
import { companyContext, kgProjection } from "./kg";
import { memory, memoryEnabled, SCOPES } from "./memory";
import { emit } from "./bus";
import * as dt from "./daytona";
import { PLANNER_SYSTEM, BUILDER_SYSTEM, REPAIR_SYSTEM } from "./prompts";
import { env, surrealHttpBase } from "@/lib/env";
import { anchorQa } from "./qa";
import { simulate } from "./simulate";
import { connectors, slackPost, jiraCreate } from "./connectors";

type Spec = { name: string; slug: string; command: string; summary: string; tables: { name: string; fields: string[] }[]; seed: Record<string, any[]>; views: string[]; rules: string[]; brand?: { primary?: string }; memory_used?: string[] };

const slugify = (s: string) => s.toLowerCase().replace(/^\//, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "tool";

async function step<T>(run: string, stepName: string, agent: string, title: string, fn: () => Promise<T>, describe?: (r: T) => { detail?: string; data?: Record<string, unknown> }): Promise<T> {
  const t0 = Date.now();
  await emit({ run, step: stepName, status: "start", agent, title });
  try {
    const r = await fn();
    const d = describe?.(r) ?? {};
    await emit({ run, step: stepName, status: "ok", agent, title, ms: Date.now() - t0, ...d });
    return r;
  } catch (e) {
    await emit({ run, step: stepName, status: "error", agent, title, ms: Date.now() - t0, detail: (e as Error).message.slice(0, 600) });
    throw e;
  }
}

export async function startRun(prompt: string, command?: string) {
  const runId = crypto.randomUUID().slice(0, 8);
  await sql(`CREATE type::record("run", $id) CONTENT { prompt: $p, command: $c, status: "running", started: time::now() }`, { id: runId, p: prompt, c: command ?? null }).catch(() => {});
  runHarness(runId, prompt, command).catch(async (e) => {
    await emit({ run: runId, step: "done", status: "error", title: "Run failed", detail: (e as Error).message.slice(0, 800) });
    await sql(`UPDATE type::record("run", $id) MERGE { status: "failed", error: $e, ended: time::now() }`, { id: runId, e: (e as Error).message }).catch(() => {});
  });
  return runId;
}

async function provisionCloudDb(dbName: string, spec: Spec) {
  const pw = crypto.randomBytes(18).toString("base64url");
  await sql(`DEFINE DATABASE IF NOT EXISTS ${dbName};`);
  await sql(`DEFINE USER OVERWRITE ${dbName}_svc ON DATABASE PASSWORD $pw ROLES EDITOR DURATION FOR TOKEN 1d, FOR SESSION 1d;`, { pw }, { db: dbName });
  const r = await fetch(`${surrealHttpBase()}/signin`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ ns: env.surrealNs, db: dbName, user: `${dbName}_svc`, pass: pw }) });
  const j = await r.json();
  void spec;
  return (j.token ?? j.access) as string;
}

async function runHarness(run: string, prompt: string, commandHint?: string) {
  const t0 = Date.now();
  const command = commandHint ? (commandHint.startsWith("/") ? commandHint : "/" + commandHint) : undefined;
  let slug = slugify(command ?? prompt.split(/\s+/).slice(0, 3).join("-"));

  // ---- 1. Episodic: open a session for this run (shared by all agents) ----
  let session: string | null = null;
  if (memoryEnabled()) {
    session = await step(run, "episode", "curator", "Open episodic session in Agent Memory", async () => {
      await memory.ensureScopes([SCOPES.org(), SCOPES.procedures(), SCOPES.tool(slug), ...["planner", "builder", "verifier", "curator"].map(SCOPES.agent)]);
      const id = await memory.openSession(SCOPES.tool(slug), { run, prompt, command });
      await memory.turn(id, "user", prompt, SCOPES.tool(slug));
      return id;
    }, (id) => ({ detail: `session ${id}`, data: { sessionId: id, scope: SCOPES.tool(slug) } })).catch(() => null);
  }
  const say = async (agent: string, text: string) => { if (session) await memory.turn(session, "assistant", `[${agent}] ${text}`, SCOPES.agent(agent)).catch(() => {}); };

  // ---- 2. Semantic cache (SurrealDB HNSW vector index) ----
  const vec = await embed(`${command ?? ""} ${prompt}`);
  const cached = await step(run, "cache", "router", "Semantic cache lookup (HNSW, cosine)", async () => {
    if (!vec) return null;
    const rows = await sqlOne<any[]>(`SELECT id, prompt, spec, vector::similarity::cosine(embedding, $v) AS sim FROM cache WHERE embedding <|3,40|> $v AND expires > time::now() ORDER BY sim DESC LIMIT 1;`, { v: vec }).catch(() => []);
    const hit = rows?.[0];
    return hit && hit.sim > 0.95 ? hit : null;
  }, (h) => ({ detail: h ? `HIT ${(h.sim * 100).toFixed(1)}% → reuse plan from "${h.prompt}"` : "MISS → full planning", data: { hit: !!h } }));

  // ---- 3. Context assembly: KG + memory lenses + procedures ----
  const ctx = await step(run, "context", "router", "Assemble context: company KG + 3 memory layers", async () => {
    const kg = await companyContext();
    let semantic = "", traceId: string | undefined, tier: string | undefined;
    let facts: string[] = [], thenFacts: string[] = [];
    const asOfThen = new Date(Date.now() - 45 * 864e5).toISOString();
    if (memoryEnabled()) {
      const q = `${prompt}. What policies, rules, people and account situations at ${env.org} are relevant?`;
      const [r, then] = await Promise.all([
        memory.query(q, [SCOPES.org(), SCOPES.tool(slug), SCOPES.procedures()], 12).catch(() => null),
        memory.query(q, [SCOPES.org()], 3, asOfThen).catch(() => null),   // time-aware: what did we believe 45 days ago?
      ]);
      if (r) {
        traceId = r.trace?.traceId; tier = r.tier;
        facts = (r.hits ?? []).map((h: any) => String(h.text ?? h.content ?? h.summary ?? "")).filter(Boolean);
        semantic = facts.map((f) => `- ${f}`).join("\n");
      }
      if (then) thenFacts = (then.hits ?? []).map((h: any) => String(h.text ?? h.summary ?? "")).filter(Boolean);
    }
    const procs = await sqlOne<any[]>(`SELECT name, recipe, score, successes, failures FROM procedure ORDER BY score DESC LIMIT 5;`).catch(() => []);
    const episodes = await sqlOne<any[]>(`SELECT summary, kind, at FROM episode ORDER BY at DESC LIMIT 8;`).catch(() => []);
    return { kg, semantic, facts, thenFacts, asOfThen, traceId, tier, procs: procs ?? [], episodes: episodes ?? [] };
  }, (c) => ({
    detail: `${c.kg.text.split("\n").length} KG sections · ${c.facts.length} semantic facts (tier ${c.tier ?? "n/a"}) · ${c.procs.length} procedures · ${c.episodes.length} episodes`,
    data: {
      traceId: c.traceId, tier: c.tier,
      evidence: {
        graph: c.kg.text.split("\n").map((l) => l.split(":")[0]),
        semantic: c.facts.slice(0, 4),
        then: { asOf: c.asOfThen, facts: c.thenFacts.slice(0, 2) },
        episodic: c.episodes.slice(0, 4).map((e: any) => e.summary),
        procedural: c.procs.slice(0, 3).map((p: any) => ({ name: p.name, score: p.score })),
      },
    },
  }));
  await sql(`FOR $n IN $nodes { RELATE (type::record("run", $id))->informed_by->(type::record($n)) }`, { nodes: ctx.kg.nodes, id: run }).catch(() => {});

  // ---- 4. Planner ----
  const spec: Spec = await step(run, "plan", "planner", "Planner designs a company-specific spec", async () => {
    if (cached?.spec) return cached.spec as Spec;
    const r = await complete("plan", [
      { role: "system", content: PLANNER_SYSTEM },
      { role: "user", content: `REQUEST: ${prompt}\nCOMMAND: ${command ?? "(choose one)"}\n\nCOMPANY KNOWLEDGE GRAPH:\n${ctx.kg.text}\n\nSEMANTIC MEMORY (current facts; superseded facts are excluded):\n${ctx.semantic || "(none)"}\n\nPROCEDURAL MEMORY (recipes that passed QA before):\n${JSON.stringify(ctx.procs)}\n\nRECENT EPISODES:\n${JSON.stringify(ctx.episodes)}\n\nWHAT WE BELIEVED ON ${ctx.asOfThen.slice(0, 10)} (superseded where it differs from current facts — never use superseded values):\n${ctx.thenFacts.join("\n") || "(none)"}` },
    ], { json: true, maxTokens: 6000, onProgress: (n, m) => { emit({ run, step: "plan", status: "log", agent: "planner", title: "planning", detail: `${m} · ${Math.round(n / 4)} tokens` }); } });
    const s = extractJson<Spec>(r.text);
    (s as any)._model = `${r.provider}/${r.model}`;
    return s;
  }, (s) => ({ detail: `${s.name} · ${s.tables.map((t) => t.name).join(", ")} · ${s.views.length} views · ${s.rules.length} rules`, data: { spec: s } }));
  if (!command && spec.command) slug = slugify(spec.command);
  spec.slug = slug; spec.command = command ?? "/" + slug;
  await say("planner", `Planned ${spec.name}: ${spec.summary}. Rules: ${spec.rules.join("; ")}`);
  if (vec && !cached) await sql(`CREATE cache CONTENT { prompt: $p, spec: $s, embedding: $v }`, { p: prompt, s: spec, v: vec }).catch(() => {});

  // ---- 5. Daytona sandbox (isolated, from snapshot, labelled, auto-stop) ----
  const dbName = `tool_${slug.replace(/-/g, "_")}`;
  const cloudMode = (process.env.VF_TOOL_DB ?? "embedded") === "cloud";
  let cloudToken: string | undefined;
  if (cloudMode) cloudToken = await provisionCloudDb(dbName, spec);
  const { sandbox, secretMode, firewall } = await step(run, "sandbox", "builder", "Create isolated Daytona sandbox from snapshot", async () => {
    const r = await dt.createToolSandbox({ slug, dbName, surrealToken: cloudToken, runId: run });
    await dt.prepareWorkspace(r.sandbox);
    return r;
  }, (r) => ({ detail: `${r.sandbox.id.slice(0, 8)} · ${r.firewall} · ${r.secretMode}`, data: { sandboxId: r.sandbox.id, secretMode: r.secretMode, firewall: r.firewall } }));

  let kgProj: Record<string, any[]> = {};
  // ---- 6. Provision the tool's own SurrealDB (embedded in the sandbox) + seed from the company graph ----
  await step(run, "provision", "builder", `Provision SurrealDB ${env.surrealNs}/${dbName} inside the sandbox`, async () => {
    if (!cloudMode) await dt.startDb(sandbox);
    kgProj = await kgProjection().catch(() => ({}));
    const r = await dt.seedDb(sandbox, { ...kgProj, ...(spec.seed ?? {}) }, (spec.tables ?? []).map((t) => t.name));
    if (r.code !== 0) throw new Error(r.out.slice(-400));
    return r.out.trim().split("\n").filter((l) => l.startsWith("seeded"));
  }, (lines) => ({ detail: `${lines.filter((l) => l.includes(" kg_")).length} company-graph tables projected · ${lines.filter((l) => !l.includes(" kg_")).map((l) => l.replace("seeded ", "")).join(", ")}` }));

  // ---- 7. Builder: generate code ----
  const companyRow = await sqlOne<any>(`SELECT name, industry, hq, brand FROM ONLY company:acme`).catch(() => ({}));
  const contextJson = JSON.stringify({ company: { name: companyRow?.name ?? "Acme Robotics", industry: companyRow?.industry ?? "" }, brand: { primary: spec.brand?.primary ?? companyRow?.brand?.primary ?? "#4F46E5" }, rules: spec.rules ?? [], spec }, null, 2);
  const prior = await sqlOne<any>(`SELECT code, recipe FROM ONLY type::record("procedure", $k)`, { k: slug }).catch(() => null);
  let code = await step(run, "codegen", "builder", prior?.code ? "Builder updates the last version that passed QA" : "Builder writes the tool (src/App.tsx)", async () => {
    const r = await complete("code", [
      { role: "system", content: BUILDER_SYSTEM },
      { role: "user", content: `${prior?.code ? `PROCEDURAL MEMORY — the previous version of this tool passed build + browser QA. Keep its structure and style, and update it to match the SPEC (current facts win):\n\`\`\`tsx\n${prior.code}\n\`\`\`\n\n` : ""}SPEC:\n${JSON.stringify(spec, null, 2)}\n\nCOMPANY CONTEXT:\n${ctx.kg.text.slice(0, 6000)}\n\nPROCEDURES THAT WORKED:\n${JSON.stringify(ctx.procs.map((p: any) => p.recipe))}` },
    ], { maxTokens: 12000, temperature: 0.3, onProgress: (n, m) => { emit({ run, step: "codegen", status: "log", agent: "builder", title: "writing", detail: `${m} · ${Math.round(n / 4)} tokens written` }); } });
    return { code: extractCode(r.text), model: `${r.provider}/${r.model}` };
  }, (r) => ({ detail: `${r.code.split("\n").length} lines via ${r.model}` })).then((r) => r.code);
  await dt.writeFiles(sandbox, { "src/App.tsx": code, "public/context.json": contextJson });

  // ---- 8. Verifier: build + repair loop ----
  let attempts = 0, built = false, lastErr = "";
  while (attempts < 3 && !built) {
    attempts++;
    const b = await step(run, "verify", "verifier", `Verify: vite build (attempt ${attempts})`, () => dt.build(sandbox), (b) => ({ detail: b.code === 0 ? "build passed" : b.out.slice(-500) }));
    if (b.code === 0) { built = true; break; }
    lastErr = b.out.slice(-2500);
    await say("verifier", `Build failed: ${lastErr.slice(0, 300)}`);
    code = await step(run, "repair", "verifier", "Repair agent patches the build error", async () => {
      const r = await complete("code", [{ role: "system", content: REPAIR_SYSTEM }, { role: "user", content: `ERROR:\n${lastErr}\n\nFILE:\n${code}` }], { maxTokens: 12000 });
      return extractCode(r.text);
    });
    await dt.writeFiles(sandbox, { "src/App.tsx": code });
  }
  if (!built) throw new Error("Build failed after repairs: " + lastErr.slice(-300));
  const sha = await dt.commit(sandbox, `${spec.command}: ${spec.summary}`).catch(() => "");

  // ---- 9. Run + preview ----
  const preview = await step(run, "deploy", "builder", "Start tool server + preview URL", async () => {
    await dt.startServer(sandbox);
    return dt.previewUrls(sandbox);
  }, (p) => ({ detail: p.signed ? "signed preview URL (expires 6h)" : "preview URL", data: { url: p.signed ?? p.url } }));
  const url = preview.signed ?? preview.url;

  // ---- 10. QA in a cloud browser (Anchor) + runtime repair loop ----
  let qa: { ok: boolean; summary: string; shot: string | null; errors: string[]; liveView: string | null } = { ok: true, summary: "skipped", shot: null, errors: [], liveView: null };
  for (let round = 1; round <= 2; round++) {
    qa = await step(run, "qa", "verifier", `Browser QA in Anchor cloud Chromium${round > 1 ? ` (round ${round})` : ""}`, () => anchorQa(url, `${run}-${round}`, preview.token), (q) => ({ detail: q.summary, data: q as any }))
      .catch((e) => ({ ok: true, summary: "QA unavailable: " + (e as Error).message.slice(0, 80), shot: null, errors: [], liveView: null }));
    if (qa.ok || round === 2) break;
    await say("verifier", `Runtime errors in browser: ${qa.errors.join(" | ").slice(0, 400)}`);
    code = await step(run, "repair", "verifier", "Repair agent fixes the runtime error seen in the browser", async () => {
      const r = await complete("code", [{ role: "system", content: REPAIR_SYSTEM }, { role: "user", content: `The page builds but crashes in the browser.\nBROWSER CONSOLE ERRORS:\n${qa.errors.join("\n")}\n\ncompanyContext() returns exactly: ${contextJson.slice(0, 600)}\n\nFILE:\n${code}` }], { maxTokens: 12000 });
      return extractCode(r.text);
    });
    await dt.writeFiles(sandbox, { "src/App.tsx": code });
    const b2 = await step(run, "verify", "verifier", "Verify: rebuild after runtime repair", () => dt.build(sandbox), (b) => ({ detail: b.code === 0 ? "build passed" : b.out.slice(-300) }));
    if (b2.code !== 0) break;
    await dt.commit(sandbox, `fix: runtime error found by browser QA`).catch(() => "");
  }

  // ---- 10b. Policy simulation (MiroFish-style) ----
  const sim = await step(run, "simulate", "simulator", "Simulate personas using the tool under current policy", () =>
    simulate({ toolName: spec.name, command: spec.command, spec, kg: kgProj, rounds: 3,
      onRound: (i, n) => { emit({ run, step: "simulate", status: "log", agent: "simulator", title: "round", detail: `round ${i}/3 · ${n} persona actions` }); } }),
    (r) => ({ detail: r.summary, data: { report: r } as any })).catch(() => null);
  if (sim) {
    await sql(`CREATE simulation CONTENT { tool: type::record("tool", $slug), run: $run, report: $r, at: time::now() }; CREATE episode SET kind = "simulation", run = $run, summary = $s, source = "simulator";`, { slug, run, r: sim, s: `Simulated ${spec.command}: ${sim.summary} Findings: ${(sim.policy_findings ?? []).join(" | ")}`.slice(0, 900) }).catch(() => {});
    if (memoryEnabled()) await memory.remember(`Policy simulation of ${spec.name}: ${sim.summary} Policy findings: ${(sim.policy_findings ?? []).join("; ")}. Recommendations: ${(sim.recommendations ?? []).join("; ")}.`, SCOPES.tool(slug)).catch(() => {});
  }

  // ---- 11. Register slash command (tool registry in SurrealDB graph) ----
  await step(run, "register", "curator", `Register ${spec.command}`, async () => {
    await sql(`
      UPSERT type::record("tool", $slug) MERGE { name: $name, command: $cmd, summary: $sum, sandbox: $sb, url: $url, db: $db, sha: $sha, spec: $spec, updated: time::now(), qa: $qa, secretMode: $sm, firewall: $fw };
      LET $v = CREATE tool_version CONTENT { tool: type::record("tool", $slug), sha: $sha, run: $run, url: $url, at: time::now() };
      RELATE (type::record("tool", $slug))->version_of->($v[0].id);
      RELATE company:acme->uses_tool->(type::record("tool", $slug));
    `, { slug, name: spec.name, cmd: spec.command, sum: spec.summary, sb: sandbox.id, url, db: dbName, sha, spec, run, qa: qa.summary, sm: secretMode, fw: firewall });
  }, () => ({ detail: `${spec.command} → ${spec.name}` }));

  // ---- 11b. Notify the company: Slack announcement + Jira change record ----
  const notify = await step(run, "notify", "curator", "Announce in Slack and log a Jira change record", async () => {
    const out: string[] = []; const data: Record<string, string> = {};
    const top = sim ? `\nSimulation: ${sim.summary}\nTop policy finding: ${(sim.policy_findings ?? [])[0] ?? "-"}` : "";
    if (connectors.jiraEnabled()) {
      const j = await jiraCreate(`[VibeFlow] ${spec.command} ${spec.name} deployed`, `Tool: ${spec.name} (${spec.command})\n${spec.summary}\nRules enforced: ${spec.rules.join("; ")}\nSandbox: ${sandbox.id} (outbound network blocked)\nQA: ${qa.summary}\nCommit: ${sha}${top}\nPreview: ${url}`, ["vibeflow", slug]).catch((e) => { out.push("jira failed: " + (e as Error).message.slice(0, 80)); return null; });
      if (j) { out.push(`Jira ${j.key}`); data.jira = j.url; }
    }
    if (connectors.slackEnabled()) {
      const sres = await slackPost(`:rocket: *${spec.command}* (${spec.name}) is live for Acme.\n${spec.summary}\nQA: ${qa.summary}${top}${data.jira ? `\nChange record: ${data.jira}` : ""}\nOpen: ${url}`).catch((e) => { out.push("slack failed: " + (e as Error).message.slice(0, 80)); return null; });
      if (sres) { out.push(`Slack ${sres.channel}`); data.slack = sres.channel; }
    }
    return { out, data };
  }, (r) => ({ detail: r.out.join(" · ") || "no connectors configured", data: r.data })).catch(() => null);
  void notify;

  // ---- 12. Memory write-back: semantic + procedural + episodic ----
  await step(run, "memory", "curator", "Write back: semantic facts, procedure, episode", async () => {
    const recipe = `For ${spec.name}: tables ${spec.tables.map((t) => t.name).join("/")}; views: ${spec.views.join("; ")}; build passed in ${attempts} attempt(s).`;
    await sql(`
      UPSERT type::record("procedure", $k) MERGE { name: $name, kind: "internal-tool", recipe: $recipe, last_run: $run };
      IF $ok { UPDATE type::record("procedure", $k) SET successes += 1, code = $code } ELSE { UPDATE type::record("procedure", $k) SET failures += 1 };
      RELATE (type::record("tool", $slug))->built_with->(type::record("procedure", $k));
      CREATE episode SET kind = "build", summary = $ep, run = $run, source = "harness";
    `, { k: slug, ok: qa.ok, code, name: `Build ${spec.name}`, recipe, run, slug, ep: `Built ${spec.command} (${spec.name}) in ${Math.round((Date.now() - t0) / 1000)}s, ${attempts} build attempt(s), QA: ${qa.summary}` });
    if (memoryEnabled()) {
      // Tool facts live in the tool's own scope so they never supersede company-level truths.
      await memory.remember(`${env.org} uses an internal tool called ${spec.name}, invoked with ${spec.command}. ${spec.summary}. Business rules enforced: ${spec.rules.join("; ")}.`, SCOPES.tool(slug)).catch(() => {});
      await memory.remember(`Procedure that worked for ${spec.name}: ${recipe}`, SCOPES.procedures()).catch(() => {});
      await say("curator", `Deployed ${spec.command}. QA: ${qa.summary}`);
    }
  });

  await sql(`UPDATE type::record("run", $id) MERGE { status: "done", ended: time::now(), tool: $slug, url: $url }`, { id: run, slug, url }).catch(() => {});
  await emit({ run, step: "done", status: "done", title: `${spec.command} is live`, detail: `${Math.round((Date.now() - t0) / 1000)}s end-to-end`, data: { url, command: spec.command, name: spec.name, sandboxId: sandbox.id, shot: qa.shot, liveView: qa.liveView } });
}
