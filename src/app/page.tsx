"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Hammer, LayoutGrid, Workflow, Brain, Share2, ShieldCheck, X, ExternalLink, Database } from "lucide-react";
import CommandBar, { type Tool } from "@/components/CommandBar";
import RunPanel, { useRun } from "@/components/RunPanel";
import HarnessView from "@/components/HarnessView";
import MemoryView from "@/components/MemoryView";
import SecurityView from "@/components/SecurityView";
import ToolsView from "@/components/ToolsView";

const Canvas = dynamic(() => import("@/components/Canvas"), { ssr: false });
const GraphView = dynamic(() => import("@/components/GraphView"), { ssr: false });

type View = "build" | "tools" | "harness" | "memory" | "graph" | "security";
const NAV: { id: View; label: string; icon: any }[] = [
  { id: "build", label: "Build", icon: Hammer },
  { id: "tools", label: "Tools", icon: LayoutGrid },
  { id: "harness", label: "Harness", icon: Workflow },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "graph", label: "Company graph", icon: Share2 },
  { id: "security", label: "Security", icon: ShieldCheck },
];

export default function Home() {
  const [view, setView] = useState<View>("build");
  const [tools, setTools] = useState<Tool[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [openTool, setOpenTool] = useState<Tool | null>(null);
  const [seedText, setSeedText] = useState<string>();
  const [setup, setSetup] = useState<string>("");
  const events = useRun(runId);
  const done = events.find((e) => e.step === "done");
  const busy = !!runId && !done;

  const loadTools = useCallback(() => fetch("/api/tools").then((r) => r.json()).then((d) => setTools(d.tools ?? [])).catch(() => {}), []);
  useEffect(() => { loadTools(); }, [loadTools]);
  useEffect(() => { if (done) loadTools(); }, [done, loadTools]);

  const run = async (prompt: string, command?: string) => {
    setOpenTool(null);
    const r = await fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, command }) }).then((r) => r.json());
    setRunId(r.id);
  };
  const doSetup = async () => {
    setSetup("Seeding company graph and memory");
    const s = await fetch("/api/seed", { method: "POST" }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    setSetup(s.ok ? `Company seeded · memory: ${s.memory}` : `Seed failed: ${s.error ?? "see server log"}`);
  };

  return (
    <div className="h-screen flex">
      <nav className="w-[200px] shrink-0 bg-panel border-r border-line flex flex-col">
        <div className="px-4 pt-4 pb-5">
          <div className="text-[19px] font-semibold tracking-tight">VibeFlow</div>
          <div className="text-[12px] text-graphite">Acme Robotics workspace</div>
        </div>
        {NAV.map((n) => (
          <button key={n.id} onClick={() => { setView(n.id); setOpenTool(null); }} aria-current={view === n.id}
            className={`mx-2 px-3 py-2 rounded-md flex items-center gap-2.5 text-[13.5px] ${view === n.id ? "bg-paper font-medium text-ink" : "text-graphite hover:text-ink"}`}>
            <n.icon size={16} /> {n.label}
          </button>
        ))}
        <div className="mt-6 mx-4 text-[12px] text-graphite font-medium">Commands</div>
        <div className="mx-2 mt-1 overflow-y-auto">
          {tools.map((t) => (
            <button key={String(t.id)} onClick={() => setOpenTool(t)} className="w-full text-left px-3 py-1.5 rounded-md hover:bg-paper font-mono text-[13px] text-cobalt">{t.command}</button>
          ))}
          {!tools.length && <div className="px-3 text-[12px] text-graphite">None yet</div>}
        </div>
        <div className="mt-auto p-3 border-t border-line">
          <button onClick={doSetup} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md border border-line text-[12.5px] hover:bg-paper"><Database size={14} /> Seed company data</button>
          {setup && <div className="text-[11.5px] text-graphite mt-1.5">{setup}</div>}
        </div>
      </nav>

      <main className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-1 min-h-0">
          {openTool ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-3 px-4 py-2 border-b border-line bg-panel">
                <span className="font-mono text-cobalt">{openTool.command}</span><span className="font-medium">{openTool.name}</span>
                <a href={openTool.url} target="_blank" className="ml-auto text-[13px] text-graphite flex items-center gap-1 hover:text-ink">New tab <ExternalLink size={13} /></a>
                <button onClick={() => setOpenTool(null)} aria-label="Close tool" className="p-1 rounded hover:bg-paper"><X size={16} /></button>
              </div>
              <iframe src={openTool.url} className="flex-1 w-full bg-white" title={openTool.name} />
            </div>
          ) : view === "build" ? <Canvas onCompile={(d) => setSeedText(d)} />
            : view === "tools" ? <ToolsView tools={tools} onOpen={setOpenTool} />
            : view === "harness" ? <HarnessView events={events} />
            : view === "memory" ? <MemoryView />
            : view === "graph" ? <GraphView />
            : <SecurityView />}
        </div>
        {(view === "build" || openTool) && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[min(760px,90%)]">
            <CommandBar tools={tools} onRun={run} onOpenTool={setOpenTool} busy={busy} seed={seedText} />
          </div>
        )}
      </main>

      {runId && <RunPanel runId={runId} events={events} onClose={() => setRunId(null)} />}
    </div>
  );
}
