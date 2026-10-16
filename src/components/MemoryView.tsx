"use client";
import { useEffect, useState } from "react";
import { History, Search } from "lucide-react";
import { LAYER_COLOR } from "./steps";

const LAYERS = [
  { id: "episodic", name: "Episodic", q: "What happened?", store: "Agent Memory sessions + SurrealDB episode table (DEFINE EVENT writes one on every graph change)",
    better: "The planner sees what went wrong last build and what changed in the company since.", safer: "Every run is an immutable, replayable record of who did what." },
  { id: "semantic", name: "Semantic", q: "What is true now?", store: "Agent Memory facts with valid_from / valid_until and a history chain per key",
    better: "Tools are built on current facts. A renamed stage or a new rule supersedes the old one instead of overwriting it.", safer: "Old values stay auditable and recall returns a trace id you can follow to the source." },
  { id: "procedural", name: "Procedural", q: "What works?", store: "SurrealDB procedure table, scored (successes+1)/(runs+2), linked to the tools built with it",
    better: "Recipes that passed QA are reused, so the second tool builds faster and fails less.", safer: "Only verified recipes are promoted. Failures lower the score." },
];

export default function MemoryView() {
  const [data, setData] = useState<any>(null);
  const [q, setQ] = useState("What are Acme's sales pipeline stages?");
  const [recall, setRecall] = useState<any>(null);
  const [fact, setFact] = useState("Acme Robotics renamed the Negotiation stage to Legal Review; stages are now Lead, Qualified, Demo, Proposal, Legal Review, Closed Won, Closed Lost.");
  const [writing, setWriting] = useState(false);
  const [hist, setHist] = useState<any[]>([]);
  const loadHist = () => fetch("/api/memory?entity=organisation:acme_robotics&key=sales_pipeline_stages").then((r) => r.json()).then((d) => setHist(d.history?.history ?? [])).catch(() => {});
  useEffect(() => { loadHist(); }, []);
  const load = () => fetch("/api/memory").then((r) => r.json()).then(setData).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);

  const doRecall = async () => { setRecall({ loading: true }); setRecall(await fetch(`/api/memory?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((d) => d.recall)); };
  const supersede = async () => {
    setWriting(true);
    await fetch("/api/memory/fact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: fact, policy: { stages: ["Lead", "Qualified", "Demo", "Proposal", "Legal Review", "Closed Won", "Closed Lost"] } }) });
    setWriting(false); load(); doRecall(); loadHist();
  };
  const attrs: any[] = Array.isArray(data?.attributes) ? data.attributes : data?.attributes?.attributes ?? data?.attributes?.items ?? [];

  return (
    <div className="h-full overflow-y-auto dotgrid">
      <div className="max-w-[1180px] mx-auto px-8 py-8">
        <h1 className="text-[26px] font-semibold tracking-tight">Memory</h1>
        <p className="text-graphite max-w-[70ch] mt-1">Three layers, one SurrealDB substrate. Each answers a different question for the agents, and each makes the harness both better and safer.</p>

        <div className="grid grid-cols-3 gap-4 mt-6">
          {LAYERS.map((l) => (
            <section key={l.id} className="bg-white border border-line rounded-xl overflow-hidden">
              <div className="h-1" style={{ background: LAYER_COLOR[l.id] }} />
              <div className="p-4">
                <div className="flex items-baseline justify-between"><h2 className="font-semibold text-[17px]" style={{ color: LAYER_COLOR[l.id] }}>{l.name}</h2><span className="text-graphite text-[13px]">{l.q}</span></div>
                <p className="text-[12.5px] text-graphite mt-2">{l.store}</p>
                <div className="mt-3 text-[13px]"><span className="font-medium">Better: </span>{l.better}</div>
                <div className="mt-1.5 text-[13px]"><span className="font-medium">Safer: </span>{l.safer}</div>
                <div className="mt-3 border-t border-line pt-3 max-h-[220px] overflow-y-auto space-y-1.5 text-[12.5px]">
                  {l.id === "episodic" && (data?.episodes ?? []).map((e: any) => (
                    <div key={String(e.id)} className="flex gap-2"><span className="text-graphite shrink-0 w-12">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span>{e.summary}</span></div>))}
                  {l.id === "semantic" && attrs.slice(0, 30).map((a: any, i: number) => (
                    <div key={i}><span className="font-medium">{String(a.key ?? "").replace(/_/g, " ")}</span>: <span className="text-graphite">{typeof a.value === "string" ? a.value : JSON.stringify(a.value ?? a)}</span></div>))}
                  {l.id === "semantic" && !attrs.length && <div className="text-graphite">{data?.enabled ? "No live attributes yet. Seed the company or build a tool." : "Agent Memory is not configured. Add SPECTRON_* keys."}</div>}
                  {l.id === "procedural" && (data?.procedures ?? []).map((p: any) => (
                    <div key={String(p.id)}><div className="flex justify-between"><span className="font-medium">{p.name}</span><span className="text-amber">{Math.round((p.score ?? 0) * 100)}%</span></div><div className="text-graphite">{p.recipe}</div></div>))}
                  {l.id === "procedural" && !(data?.procedures ?? []).length && <div className="text-graphite">No recipes yet. The first successful build creates one.</div>}
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <section className="bg-white border border-line rounded-xl p-4">
            <h2 className="font-semibold flex items-center gap-2"><History size={16} className="text-cobalt" /> Supersede a fact</h2>
            <p className="text-[12.5px] text-graphite mt-1">Write a change. Agent Memory closes the old value with valid_until and opens the new one. Rebuild /crm and it picks up the new stage.</p>
            <textarea value={fact} onChange={(e) => setFact(e.target.value)} className="w-full mt-3 border border-line rounded-md p-2 text-[13px] h-20" />
            <button onClick={supersede} disabled={writing} className="mt-2 px-3 py-1.5 rounded-md bg-cobalt text-white text-[13px] font-medium disabled:opacity-50">{writing ? "Recording" : "Record change"}</button>
          </section>
          <section className="bg-white border border-line rounded-xl p-4">
            <h2 className="font-semibold flex items-center gap-2"><Search size={16} className="text-cobalt" /> Recall with provenance</h2>
            <div className="flex gap-2 mt-3">
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doRecall()} className="flex-1 border border-line rounded-md px-2 py-1.5 text-[13px]" />
              <button onClick={doRecall} className="px-3 py-1.5 rounded-md border border-line text-[13px] hover:bg-paper">Recall</button>
            </div>
            {recall && !recall.loading && (
              <div className="mt-3 text-[12.5px]">
                {recall.error ? <div className="text-rose">{recall.error}</div> : <>
                  <div className="text-graphite">tier <b className="text-ink">{recall.tier}</b> · {recall.queryMs}ms · trace <span className="font-mono text-cobalt">{recall.trace?.traceId ?? "n/a"}</span></div>
                  <ul className="mt-2 space-y-1 max-h-[160px] overflow-y-auto">{(recall.hits ?? []).slice(0, 8).map((h: any, i: number) => (
                    <li key={i} className="border-l-2 pl-2" style={{ borderColor: LAYER_COLOR.semantic }}>{h.text ?? h.content ?? h.snippet ?? JSON.stringify(h).slice(0, 180)} <span className="text-graphite">({h.source}{h.occurredAt ? ", " + new Date(h.occurredAt).toLocaleString() : ""})</span></li>))}</ul>
                </>}
              </div>
            )}
          </section>
        </div>
        <section className="bg-white border border-line rounded-xl p-4 mt-4">
          <h2 className="font-semibold">Fact history: Acme sales pipeline stages</h2>
          <p className="text-[12.5px] text-graphite mt-1">Each value is closed, never overwritten. Every link names what it superseded and the session it came from.</p>
          <ol className="mt-3 space-y-2">
            {hist.map((h, i) => {
              const live = !h.supersededBy;
              return (
                <li key={h.id} className="grid grid-cols-[18px_1fr_220px] gap-3 text-[12.5px]">
                  <span className={`mt-1 w-2.5 h-2.5 rounded-full ${live ? "" : "opacity-40"}`} style={{ background: LAYER_COLOR.semantic }} />
                  <div className={live ? "" : "text-graphite line-through decoration-graphite/40"}>{h.value}{live && <span className="ml-2 no-underline text-[11px] px-1.5 py-0.5 rounded bg-cobalt/10 text-cobalt">current</span>}</div>
                  <div className="text-graphite text-right">{new Date(h.createdAt).toLocaleTimeString()} → {!live && h.validUntil ? new Date(h.validUntil).toLocaleTimeString() : "now"}<div className="font-mono text-[11px]">{h.source?.kind} {String(h.source?.sessionId ?? "").slice(0, 10)}</div></div>
                </li>
              );
            })}
            {!hist.length && <li className="text-[12.5px] text-graphite">No history yet.</li>}
          </ol>
        </section>
        <section className="bg-white border border-line rounded-xl p-4 mt-4">
          <h2 className="font-semibold">Semantic cache</h2>
          <p className="text-[12.5px] text-graphite mt-1">Prompts are embedded (NVIDIA Nemotron embed, 2048 dims) into an HNSW index. A near-identical request within a day reuses the plan and skips the planner.</p>
          <ul className="mt-2 text-[12.5px] space-y-1">{(data?.cache ?? []).map((c: any) => <li key={String(c.id)} className="flex justify-between"><span className="truncate">{c.prompt}</span><span className="text-graphite shrink-0 ml-4">expires {new Date(c.expires).toLocaleString()}</span></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
