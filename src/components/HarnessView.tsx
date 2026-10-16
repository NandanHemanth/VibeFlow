"use client";
import { PIPELINE, AGENT_COLOR, LAYER_COLOR } from "./steps";
import type { Ev } from "./RunPanel";

const AGENTS = [
  { id: "router", role: "Routes each request: cache check, context assembly, model choice per task." },
  { id: "planner", role: "Turns intent plus company context into a spec grounded in real stages, people and rules." },
  { id: "builder", role: "Provisions the database and sandbox, writes the code, deploys the preview." },
  { id: "verifier", role: "Builds, repairs, and checks the live page in a cloud browser." },
  { id: "curator", role: "Owns memory: opens the episode, registers the /command, writes facts and recipes back." },
];

export default function HarnessView({ events }: { events: Ev[] }) {
  const state = (step: string) => { const e = events.filter((x) => x.step === step); return e[e.length - 1]?.status ?? "idle"; };
  return (
    <div className="h-full overflow-y-auto dotgrid">
      <div className="max-w-[1180px] mx-auto px-8 py-8">
        <h1 className="text-[26px] font-semibold tracking-tight">Agent harness</h1>
        <p className="text-graphite max-w-[70ch] mt-1">Every request runs through the same twelve steps. Five agents share one memory, every tool gets its own sandbox, and nothing ships until it has been built and seen in a browser.</p>

        <div className="mt-8 grid grid-cols-6 gap-3">
          {PIPELINE.map((p, i) => {
            const st = state(p.step);
            return (
              <div key={p.step} className={`bg-white border rounded-lg p-3 relative ${st === "start" ? "border-cobalt live-step" : st === "ok" ? "border-moss/60" : st === "error" ? "border-rose" : "border-line"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-graphite">Step {i + 1}</span>
                  {p.layer && <span className="w-2 h-2 rounded-full" style={{ background: LAYER_COLOR[p.layer] }} title={`${p.layer} memory`} />}
                </div>
                <div className="font-medium text-[13.5px] mt-1">{p.label}</div>
                <div className="text-[11.5px] text-graphite mt-1 leading-snug">{p.tech}</div>
                <div className="text-[11px] mt-2 font-medium" style={{ color: AGENT_COLOR[p.agent] }}>{p.agent}</div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-[1.1fr_1fr] gap-6 mt-10">
          <section className="bg-white border border-line rounded-xl p-5">
            <h2 className="font-semibold text-[16px]">Agents</h2>
            <ul className="mt-3 space-y-3">
              {AGENTS.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="w-1 rounded-full shrink-0" style={{ background: AGENT_COLOR[a.id] }} />
                  <div><div className="font-medium capitalize">{a.id}</div><div className="text-[13px] text-graphite">{a.role}</div></div>
                </li>
              ))}
            </ul>
            <p className="text-[12.5px] text-graphite mt-4 border-t border-line pt-3">All five read and write one SurrealDB Agent Memory context. Each writes under its own scope (org/acme/agent/&lt;name&gt;) and reads through lenses, so the planner sees what the verifier learned last time.</p>
          </section>
          <section className="bg-white border border-line rounded-xl p-5">
            <h2 className="font-semibold text-[16px]">Infrastructure</h2>
            <dl className="mt-3 text-[13px] space-y-2.5">
              {[
                ["Daytona", "One sandbox per tool from a prebuilt snapshot. Filesystem API, process sessions, git history, signed preview URLs, SSH for humans, labels and auto-stop."],
                ["SurrealDB", "Company knowledge graph, run log with LIVE SELECT streaming, HNSW semantic cache, procedure scores, tool registry, and a separate database per tool."],
                ["Agent Memory", "Episodic sessions, semantic facts that supersede with history, recall traces you can audit."],
                ["Models", "NVIDIA NIM first (GLM-5.3 for planning and code, gpt-oss-20b for fast calls), Gemini second, OpenRouter free models as fallback. Chosen per task."],
                ["Anchor", "Cloud Chromium opens each new tool, records console errors and a screenshot, then the session is deleted."],
              ].map(([k, v]) => (<div key={k} className="grid grid-cols-[110px_1fr] gap-3"><dt className="font-medium">{k}</dt><dd className="text-graphite">{v}</dd></div>))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
