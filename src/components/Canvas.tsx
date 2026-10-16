"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlow, Background, BackgroundVariant, Controls, addEdge, useEdgesState, useNodesState, Handle, Position, type Connection, type Node, type Edge, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { BLOCKS, Logo } from "./Logo";
import { BLOCK_FIELDS, summarize } from "./blockConfig";

type BlockData = { kind: string; label: string; note?: string; config?: Record<string, string> };

function BlockNode({ data }: { data: BlockData }) {
  const b = BLOCKS.find((x) => x.kind === data.kind)!;
  return (
    <div className="bg-white border border-line rounded-lg shadow-[0_1px_2px_rgba(22,26,34,.06)] min-w-[170px]">
      <Handle type="target" position={Position.Left} className="!bg-white !border-graphite !w-2.5 !h-2.5" />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line" style={{ borderTop: `3px solid ${b.color}`, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
        <Logo slug={b.slug} color={b.color} label={b.label} />
        <span className="font-medium text-[13px]">{data.label}</span>
      </div>
      <div className="px-3 py-1.5 text-[11.5px] text-graphite max-w-[220px]">{data.note ?? b.hint}</div>
      {summarize(data.kind, data.config) && <div className="px-3 pb-2 text-[11px] text-ink/70 max-w-[220px] line-clamp-3">{summarize(data.kind, data.config)}</div>}
      <Handle type="source" position={Position.Right} className="!bg-white !border-graphite !w-2.5 !h-2.5" />
    </div>
  );
}
const nodeTypes = { block: BlockNode };

const STARTER: { nodes: Node<BlockData>[]; edges: Edge[] } = {
  nodes: [
    { id: "a", type: "block", position: { x: 40, y: 120 }, data: { kind: "app.calendar", label: "Calendar", note: "New meeting with an account", config: { event: "Meeting ended", filter: "a client account" } } },
    { id: "b", type: "block", position: { x: 300, y: 40 }, data: { kind: "ai.graph", label: "Company graph", note: "Find the deal + owner for that account" } },
    { id: "c", type: "block", position: { x: 300, y: 210 }, data: { kind: "ai.memory", label: "Agent Memory", note: "Recall last touchpoints and rules" } },
    { id: "d", type: "block", position: { x: 570, y: 120 }, data: { kind: "ai.agent", label: "LLM agent", note: "Draft next step + update stage" } },
    { id: "e", type: "block", position: { x: 830, y: 40 }, data: { kind: "logic.approval", label: "Approval", note: "Route by discount policy", config: { approver: "Walk org chart by policy", rule: "discount > 25% → CFO", sla: "24" } } },
    { id: "f", type: "block", position: { x: 830, y: 210 }, data: { kind: "ui.app", label: "Internal tool UI", note: "Deal desk approval inbox", config: { kind: "Approval inbox", command: "/dealdesk" } } },
  ],
  edges: [
    { id: "ab", source: "a", target: "b" }, { id: "ac", source: "a", target: "c" }, { id: "bd", source: "b", target: "d" },
    { id: "cd", source: "c", target: "d" }, { id: "de", source: "d", target: "e" }, { id: "df", source: "d", target: "f" },
  ],
};

export type CanvasGraph = { nodes: Node<BlockData>[]; edges: Edge[]; key: number; status?: string };

function Inner({ onCompile, graph }: { onCompile: (description: string) => void; graph?: CanvasGraph }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<BlockData>>(STARTER.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(STARTER.edges);
  const wrap = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  useEffect(() => {
    if (!graph?.nodes?.length) return;
    setNodes(graph.nodes); setEdges(graph.edges);
    setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 80);
    setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 700);  // refit after the run panel narrows the canvas
  }, [graph?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // Keep the whole workflow in view when side panels open or close.
  useEffect(() => {
    if (!wrap.current) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => fitView({ padding: 0.15, duration: 250 }), 150); });
    ro.observe(wrap.current);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [fitView]);
  const onConnect = useCallback((c: Connection) => setEdges((e) => addEdge({ ...c, animated: true }, e)), [setEdges]);
  const [selected, setSelected] = useState<string | null>(null);

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault();
    const kind = ev.dataTransfer.getData("application/vf-block");
    const b = BLOCKS.find((x) => x.kind === kind); if (!b) return;
    const position = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
    setNodes((n) => n.concat({ id: crypto.randomUUID().slice(0, 6), type: "block", position, data: { kind, label: b.label } }));
  };

  const compile = () => {
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const steps = edges.map((e) => `${byId[e.source]?.data.label} (${byId[e.source]?.data.note ?? ""}) → ${byId[e.target]?.data.label} (${byId[e.target]?.data.note ?? ""})`);
    onCompile(`Build this workflow as an internal tool with a UI. Blocks: ${nodes.map((n) => `${n.data.label}: ${n.data.note ?? ""}${summarize(n.data.kind, n.data.config) ? ` [${summarize(n.data.kind, n.data.config)}]` : ""}`).join("; ")}. Flow: ${steps.join("; ")}.`);
  };
  const sel = nodes.find((n) => n.id === selected);

  return (
    <div className="flex h-full">
      <aside className="w-[210px] shrink-0 border-r border-line bg-panel overflow-y-auto p-3">
        {["Triggers", "Apps", "Harness", "Logic", "Output"].map((g) => (
          <div key={g} className="mb-4">
            <div className="text-[11.5px] font-semibold text-graphite mb-1.5">{g}</div>
            {BLOCKS.filter((b) => b.group === g).map((b) => (
              <div key={b.kind} draggable onDragStart={(e) => e.dataTransfer.setData("application/vf-block", b.kind)} title={b.hint}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-paper cursor-grab text-[13px]">
                <Logo slug={b.slug} color={b.color} label={b.label} size={16} /> {b.label}
              </div>
            ))}
          </div>
        ))}
      </aside>
      <div ref={wrap} className="flex-1 relative" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes}
          onNodeClick={(_, n) => setSelected(n.id)} onPaneClick={() => setSelected(null)} fitView minZoom={0.2} defaultEdgeOptions={{ animated: true, style: { stroke: "#8a93a3" } }}>
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#c4cad3" bgColor="#f6f7f9" />
          <Controls position="top-left" showInteractive={false} />
        </ReactFlow>
        {graph?.status && <div className="absolute top-3 left-14 px-3 py-1.5 rounded-md bg-white border border-line text-[12.5px] text-graphite shadow-sm">{graph.status}</div>}
        <div className="absolute top-3 right-3 flex gap-2">
          <button onClick={() => { setNodes([]); setEdges([]); }} className="px-3 py-1.5 rounded-md border border-line bg-white text-[13px] hover:bg-paper">Clear</button>
          <button onClick={compile} className="px-3 py-1.5 rounded-md bg-cobalt text-white text-[13px] font-medium hover:brightness-110">Build this workflow</button>
        </div>
        {sel && (() => {
          const b = BLOCKS.find((x) => x.kind === sel.data.kind)!;
          const fields = BLOCK_FIELDS[sel.data.kind] ?? [];
          const setCfg = (k: string, v: string) => setNodes((ns) => ns.map((n) => n.id === sel.id ? { ...n, data: { ...n.data, config: { ...(n.data.config ?? {}), [k]: v } } } : n));
          return (
            <div className="absolute top-14 right-3 w-[300px] max-h-[75%] overflow-y-auto bg-white border border-line rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-2"><Logo slug={b.slug} color={b.color} label={b.label} /><span className="font-semibold text-[13.5px]">{b.label}</span></div>
              <label className="block text-[12px] text-graphite mb-1">What should this step do?</label>
              <textarea className="w-full border border-line rounded-md p-2 text-[13px] h-16" value={sel.data.note ?? ""}
                onChange={(e) => setNodes((ns) => ns.map((n) => n.id === sel.id ? { ...n, data: { ...n.data, note: e.target.value } } : n))} />
              {fields.map((f) => (
                <div key={f.key} className="mt-2">
                  <label className="block text-[12px] text-graphite mb-1">{f.label}</label>
                  {f.type === "select" ? (
                    <select className="w-full border border-line rounded-md px-2 py-1.5 text-[13px] bg-white" value={sel.data.config?.[f.key] ?? ""} onChange={(e) => setCfg(f.key, e.target.value)}>
                      <option value="">Choose…</option>{f.options!.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea className="w-full border border-line rounded-md p-2 text-[13px] h-16" placeholder={f.placeholder} value={sel.data.config?.[f.key] ?? ""} onChange={(e) => setCfg(f.key, e.target.value)} />
                  ) : (
                    <input type={f.type === "number" ? "number" : "text"} className="w-full border border-line rounded-md px-2 py-1.5 text-[13px]" placeholder={f.placeholder} value={sel.data.config?.[f.key] ?? ""} onChange={(e) => setCfg(f.key, e.target.value)} />
                  )}
                </div>
              ))}
              <button onClick={() => { setNodes((ns) => ns.filter((n) => n.id !== sel.id)); setSelected(null); }} className="mt-3 text-[12px] text-rose">Remove step</button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default function Canvas(props: { onCompile: (d: string) => void; graph?: CanvasGraph }) {
  return <ReactFlowProvider><Inner {...props} /></ReactFlowProvider>;
}
