"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Slash } from "lucide-react";

export type Tool = { id: string; name: string; command: string; summary: string; url: string; sandbox: string; updated?: string; qa?: string; versions?: any[]; procedures?: string[]; secretMode?: string; firewall?: string };

export const DEMO = {
  command: "/dealdesk",
  prompt: "Build our Deal Desk: a discount approval console for the sales team. Every open opportunity with a discount becomes an approval request, routed to the right approver by walking our org chart under the discount policy in force today. Each request shows the account's health, open P1 tickets, contract renewal date and the past approval decisions for that account, so the approver sees precedent. Approvers can approve, reject or escalate with a required reason, and every decision is written to an append-only audit log. Include KPIs for pending value, average discount, requests that breach the margin floor, and approval SLA.",
};
export const CRM_PROMPT = "Build our CRM modeled on Salesforce Sales Cloud and Twenty: Companies (accounts with segment, health, ARR, owner, CSM), People (contacts with role: champion, economic buyer, blocker), Opportunities (amount, stage from our pipeline, probability, close date, next step, discount) with a kanban by stage plus a sortable table view, and a record page per company showing its contacts, opportunities, contracts, tickets and an activity timeline. Add tasks with due dates and an AI insights panel per record that lists evidence-backed suggestions for a human to confirm (for example an idle deal or a renewal inside the notice window).";

const SUGGESTIONS = [
  { command: DEMO.command, prompt: DEMO.prompt },
  { command: "/crm", prompt: CRM_PROMPT },
  { command: "/tickets", prompt: "A support ticket triage board with SLA timers from our support policy, priority lanes and account context." },
  { command: "/approvals", prompt: "An approvals inbox for deals that need VP Sales sign-off, with approve/reject and an audit trail." },
  { command: "/onboarding", prompt: "An employee onboarding tracker with checklists per team and owners." },
];

export default function CommandBar({ tools, onRun, onOpenTool, busy, seed }: { tools: Tool[]; onRun: (prompt: string, command?: string) => void; onOpenTool: (t: Tool) => void; busy: boolean; seed?: string }) {
  const [text, setText] = useState("");
  const [focus, setFocus] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (seed) { setText(seed); ref.current?.focus(); } }, [seed]);

  const slash = text.match(/^\/([a-z0-9-]*)/i);
  const options = useMemo(() => {
    if (!slash) return [];
    const q = slash[1].toLowerCase();
    const existing = tools.filter((t) => t.command.slice(1).startsWith(q)).map((t) => ({ kind: "open" as const, command: t.command, text: t.summary, tool: t }));
    const sugg = SUGGESTIONS.filter((s) => s.command.slice(1).startsWith(q) && !tools.some((t) => t.command === s.command)).map((s) => ({ kind: "build" as const, command: s.command, text: s.prompt }));
    return [...existing, ...sugg];
  }, [slash, tools]);

  const submit = () => {
    const t = text.trim(); if (!t || busy) return;
    const m = t.match(/^(\/[a-z0-9-]+)\s*([\s\S]*)$/i);
    if (m) {
      const tool = tools.find((x) => x.command === m[1]);
      if (tool && !m[2]) { onOpenTool(tool); setText(""); return; }
      const sugg = SUGGESTIONS.find((s) => s.command === m[1]);
      onRun(m[2] || sugg?.prompt || `Build ${m[1]}`, m[1]);
    } else onRun(t);
    setText("");
  };

  return (
    <div className="relative">
      {focus && options.length > 0 && (
        <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-line rounded-lg shadow-lg overflow-hidden">
          {options.map((o) => (
            <button key={o.command + o.kind} onMouseDown={(e) => { e.preventDefault(); if (o.kind === "open") { onOpenTool(o.tool); setText(""); } else setText(`${o.command} ${o.text}`); }}
              className="w-full text-left px-3 py-2 hover:bg-paper flex gap-3 items-baseline">
              <span className="font-mono text-[13px] text-cobalt w-28 shrink-0">{o.command}</span>
              <span className="text-[13px] text-graphite truncate">{o.kind === "open" ? "Open tool · " : "Build new · "}{o.text}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-center mb-2">
        <button disabled={busy} onClick={() => onRun(DEMO.prompt, DEMO.command)} title={DEMO.prompt}
          className="px-3 py-1.5 rounded-full bg-white border border-cobalt/40 text-cobalt text-[12.5px] font-medium shadow-sm hover:bg-cobalt hover:text-white disabled:opacity-40">
          Run demo: build {DEMO.command} (Deal Desk)
        </button>
      </div>
      <div className="flex items-end gap-2 bg-white border border-line rounded-xl px-3 py-2 shadow-[0_2px_10px_rgba(22,26,34,.06)] focus-within:border-cobalt">
        <Slash size={16} className="text-graphite mb-2" />
        <textarea ref={ref} rows={1} value={text} onChange={(e) => setText(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Describe a tool, or type / to run a saved command" className="flex-1 resize-none outline-none text-[14px] py-1.5 max-h-40 bg-transparent" />
        <button onClick={submit} disabled={busy || !text.trim()} aria-label="Build" className="h-8 w-8 rounded-lg bg-ink text-white flex items-center justify-center disabled:opacity-30"><ArrowUp size={16} /></button>
      </div>
    </div>
  );
}
