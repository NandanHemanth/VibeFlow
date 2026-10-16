"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, XCircle, Loader2, ExternalLink, X, Radio } from "lucide-react";
import { AGENT_COLOR, PIPELINE } from "./steps";

export type Ev = { run: string; step: string; status: string; agent?: string; title: string; detail?: string; data?: any; ms?: number; via?: string; at?: string };

export function useRun(runId: string | null) {
  const [events, setEvents] = useState<Ev[]>([]);
  useEffect(() => {
    if (!runId) return;
    setEvents([]);
    const es = new EventSource(`/api/run/${runId}/stream`);
    es.onmessage = (m) => { try { const e = JSON.parse(m.data); setEvents((x) => [...x, e]); } catch { /* */ } };
    return () => es.close();
  }, [runId]);
  return events;
}

export function stepState(events: Ev[], step: string) {
  const evs = events.filter((e) => e.step === step);
  const last = evs[evs.length - 1];
  return last?.status ?? "idle";
}

export default function RunPanel({ runId, events, onClose }: { runId: string; events: Ev[]; onClose: () => void }) {
  const done = events.find((e) => e.step === "done");
  const failed = done?.status === "error";
  const viaLive = events.some((e) => e.via === "surreal-live");
  const finals = PIPELINE.map((p) => {
    const evs = events.filter((e) => e.step === p.step);
    return { ...p, last: evs[evs.length - 1], count: evs.filter((e) => e.status === "start").length };
  });
  return (
    <aside className="w-[400px] shrink-0 border-l border-line bg-panel flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <div>
          <div className="font-semibold">Run {runId}</div>
          <div className="text-[12px] text-graphite flex items-center gap-1.5">
            <Radio size={12} className={viaLive ? "text-moss" : "text-graphite"} />
            {viaLive ? "Streaming from SurrealDB LIVE SELECT" : "Streaming"}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close run" className="p-1 rounded hover:bg-paper"><X size={16} /></button>
      </div>
      <ol className="flex-1 overflow-y-auto px-4 py-3">
        {finals.map((s) => {
          const st = s.last?.status ?? "idle";
          const Icon = st === "ok" ? CheckCircle2 : st === "error" ? XCircle : st === "start" ? Loader2 : CircleDashed;
          const color = st === "ok" ? "text-moss" : st === "error" ? "text-rose" : st === "start" ? "text-cobalt" : "text-[#b7bec9]";
          return (
            <li key={s.step} className="flex gap-3 pb-3 relative">
              <Icon size={18} className={`${color} shrink-0 mt-0.5 ${st === "start" ? "animate-spin" : ""}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[13px] font-medium ${st === "idle" ? "text-graphite" : ""}`}>{s.label}</span>
                  <span className="text-[11px] px-1.5 rounded" style={{ color: AGENT_COLOR[s.agent], background: AGENT_COLOR[s.agent] + "14" }}>{s.agent}</span>
                  {s.count > 1 && <span className="text-[11px] text-amber">×{s.count}</span>}
                  {s.last?.ms != null && <span className="text-[11px] text-graphite ml-auto">{(s.last.ms / 1000).toFixed(1)}s</span>}
                </div>
                <div className="text-[12px] text-graphite">{s.tech}</div>
                {s.last?.detail && <div className={`text-[12px] mt-0.5 break-words ${st === "error" ? "text-rose" : "text-ink/80"}`}>{s.last.detail}</div>}
                {s.step === "context" && s.last?.data?.traceId && <div className="text-[11.5px] font-mono text-cobalt mt-0.5">trace {String(s.last.data.traceId).slice(0, 18)}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      <Evidence events={events} />
      <Simulation events={events} />
      {done && (
        <div className={`border-t border-line p-4 ${failed ? "bg-rose/5" : "bg-moss/5"}`}>
          <div className={`font-semibold ${failed ? "text-rose" : "text-moss"}`}>{done.title}</div>
          <div className="text-[12.5px] text-graphite break-words">{done.detail}</div>
          {done.data?.url && <a href={done.data.url} target="_blank" className="inline-flex items-center gap-1 mt-2 text-cobalt text-[13px] font-medium">Open {done.data.command} <ExternalLink size={13} /></a>}
        </div>
      )}
    </aside>
  );
}

const LAYERS: [string, string, string][] = [
  ["graph", "Knowledge graph", "#7a4fd6"], ["semantic", "Semantic · what is true now", "#2f5bea"],
  ["then", "Time-aware · what we believed then", "#2f5bea"], ["episodic", "Episodic · what happened", "#0f8b8d"],
  ["procedural", "Procedural · what works", "#b7791f"],
];
function Evidence({ events }: { events: Ev[] }) {
  const ctx = [...events].reverse().find((e) => e.step === "context" && e.status === "ok");
  const cache = [...events].reverse().find((e) => e.step === "cache" && e.status === "ok");
  const ev = ctx?.data?.evidence;
  if (!ev) return null;
  const rows: Record<string, string[]> = {
    graph: (ev.graph ?? []).map((g: string) => g.toLowerCase()),
    semantic: ev.semantic ?? [],
    then: (ev.then?.facts ?? []).map((f: string) => `as of ${String(ev.then.asOf).slice(0, 10)}: ${f}`),
    episodic: ev.episodic ?? [],
    procedural: (ev.procedural ?? []).map((p: any) => `${p.name} · score ${Math.round((p.score ?? 0) * 100)}%`),
  };
  return (
    <details className="border-t border-line px-4 py-3 max-h-[42%] overflow-y-auto" open>
      <summary className="font-semibold text-[13px] cursor-pointer">Memory used for this build</summary>
      {cache?.detail && <div className="text-[12px] mt-2"><span className="font-medium text-graphite">Cache · </span>{cache.detail}</div>}
      {LAYERS.map(([k, label, color]) => rows[k]?.length ? (
        <div key={k} className="mt-2">
          <div className="text-[12px] font-medium" style={{ color }}>{label}</div>
          {k === "graph" ? <div className="text-[11.5px] text-graphite">{rows[k].join(" · ")}</div>
            : rows[k].slice(0, 3).map((t, i) => <div key={i} className="text-[11.5px] text-ink/80 border-l-2 pl-2 mt-1 line-clamp-2" style={{ borderColor: color }}>{t}</div>)}
        </div>) : null)}
      {ctx?.data?.traceId && <div className="text-[11px] font-mono text-graphite mt-2">recall trace {ctx.data.traceId}</div>}
    </details>
  );
}

function Simulation({ events }: { events: Ev[] }) {
  const sim = [...events].reverse().find((e) => e.step === "simulate" && e.status === "ok")?.data?.report;
  if (!sim) return null;
  const block = (title: string, items: string[] | undefined, color: string) => items?.length ? (
    <div className="mt-2"><div className="text-[12px] font-medium" style={{ color }}>{title}</div>
      {items.slice(0, 4).map((t, i) => <div key={i} className="text-[11.5px] border-l-2 pl-2 mt-1" style={{ borderColor: color }}>{t}</div>)}</div>) : null;
  return (
    <details className="border-t border-line px-4 py-3 max-h-[45%] overflow-y-auto" open>
      <summary className="font-semibold text-[13px] cursor-pointer">Policy simulation · strategy and prediction</summary>
      <p className="text-[12px] text-graphite mt-1">{sim.summary}</p>
      {sim.metrics && <div className="flex flex-wrap gap-2 mt-2">{Object.entries(sim.metrics).map(([k, v]) => <span key={k} className="text-[11px] px-2 py-0.5 rounded bg-paper border border-line">{k.replace(/_/g, " ")}: <b>{String(v)}</b></span>)}</div>}
      {block("Predictions", sim.predictions, "#2f5bea")}
      {block("Policy findings", sim.policy_findings, "#b7791f")}
      {block("Risks", sim.risks, "#c2415b")}
      {block("Recommendations", sim.recommendations, "#2f855a")}
      <details className="mt-2"><summary className="text-[12px] text-graphite cursor-pointer">Simulation log ({(sim.rounds ?? []).reduce((a: number, r: any) => a + r.events.length, 0)} persona actions)</summary>
        {(sim.rounds ?? []).map((r: any) => <div key={r.round} className="mt-1"><div className="text-[11.5px] font-medium">Week {r.round}</div>
          {r.events.map((e: any, i: number) => <div key={i} className="text-[11px] text-ink/80"><b>{e.actor}</b>: {e.action} → <span className="text-graphite">{e.outcome}</span></div>)}</div>)}
      </details>
    </details>
  );
}
