"use client";
import { useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, BackgroundVariant, type Node, type Edge } from "@xyflow/react";

const TYPE_COLOR: Record<string, string> = { company: "#161a22", team: "#5a6371", person: "#2f5bea", account: "#0f8b8d", deal: "#7a4fd6", meeting: "#b7791f", ticket: "#c2415b", policy: "#2f855a", tool: "#FF00A0" };
const RING: Record<string, number> = { company: 0, policy: 1, tool: 1, team: 1, person: 2, deal: 3, meeting: 3, account: 4, ticket: 4 };

export default function GraphView() {
  const [g, setG] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  useEffect(() => { fetch("/api/kg").then((r) => r.json()).then(setG); }, []);
  const { nodes, edges } = useMemo(() => {
    const byRing: Record<number, any[]> = {};
    g.nodes.forEach((n) => { const r = RING[n.type] ?? 4; (byRing[r] ??= []).push(n); });
    const nodes: Node[] = [];
    Object.entries(byRing).forEach(([r, list]) => {
      const radius = Number(r) * 230;
      list.forEach((n, i) => {
        const a = (i / list.length) * Math.PI * 2 + Number(r) * 0.4;
        nodes.push({ id: String(n.id), position: { x: Math.cos(a) * radius, y: Math.sin(a) * radius }, data: { label: n.label },
          style: { border: `1.5px solid ${TYPE_COLOR[n.type] ?? "#5a6371"}`, borderRadius: 8, fontSize: 13, padding: "6px 10px", fontWeight: 500, width: "auto", background: "#fff", color: "#161a22" } });
      });
    });
    const edges: Edge[] = g.edges.map((e, i) => ({ id: "e" + i, source: String(e.in), target: String(e.out), label: e.rel, style: { stroke: "#b8bfca" }, labelStyle: { fontSize: 10, fill: "#5a6371" } }));
    return { nodes, edges };
  }, [g]);
  return (
    <div className="h-full flex flex-col">
      <div className="px-8 pt-6 pb-3 bg-paper border-b border-line">
        <h1 className="text-[22px] font-semibold tracking-tight">Company graph</h1>
        <p className="text-graphite text-[13px]">People, accounts, deals, meetings, tickets and policies from Acme Robotics, stored as SurrealDB records and RELATE edges. The planner reads this graph so every tool is specific to the company.</p>
        <div className="flex gap-3 mt-2 text-[12px]">{Object.entries(TYPE_COLOR).map(([t, c]) => <span key={t} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ border: `1.5px solid ${c}` }} />{t}</span>)}</div>
      </div>
      <div className="flex-1"><ReactFlow nodes={nodes} edges={edges} fitView><Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="#c4cad3" bgColor="#f6f7f9" /></ReactFlow></div>
    </div>
  );
}
