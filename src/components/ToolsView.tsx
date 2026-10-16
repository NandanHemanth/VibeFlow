"use client";
import { useState } from "react";
import { ExternalLink, Terminal, GitCommit } from "lucide-react";
import type { Tool } from "./CommandBar";

export default function ToolsView({ tools, onOpen }: { tools: Tool[]; onOpen: (t: Tool) => void }) {
  const [ssh, setSsh] = useState<Record<string, string>>({});
  const getSsh = async (t: Tool) => {
    const slug = String(t.id).split(":")[1]?.replace(/[⟨⟩`]/g, "");
    const r = await fetch(`/api/tools/${slug}/ssh`, { method: "POST" }).then((r) => r.json()).catch(() => ({ ssh: "unavailable" }));
    setSsh((s) => ({ ...s, [t.id]: r.ssh }));
  };
  return (
    <div className="h-full overflow-y-auto dotgrid">
      <div className="max-w-[1180px] mx-auto px-8 py-8">
        <h1 className="text-[26px] font-semibold tracking-tight">Tools</h1>
        <p className="text-graphite mt-1">Every tool is a slash command. Type it in the prompt bar anywhere to open it.</p>
        <div className="grid grid-cols-2 gap-4 mt-6">
          {tools.map((t) => (
            <article key={String(t.id)} className="bg-white border border-line rounded-xl p-4">
              <div className="flex items-baseline justify-between"><span className="font-mono text-cobalt text-[15px]">{t.command}</span><span className="text-[12px] text-graphite">{t.updated ? new Date(t.updated).toLocaleString() : ""}</span></div>
              <div className="font-semibold mt-1">{t.name}</div>
              <p className="text-[13px] text-graphite mt-0.5">{t.summary}</p>
              <dl className="grid grid-cols-[90px_1fr] gap-y-1 text-[12px] mt-3">
                <dt className="text-graphite">Browser QA</dt><dd>{t.qa}</dd>
                <dt className="text-graphite">Credential</dt><dd>{t.secretMode}</dd>
                <dt className="text-graphite">Network</dt><dd className="truncate">{t.firewall}</dd>
                <dt className="text-graphite">Versions</dt><dd className="flex items-center gap-1"><GitCommit size={12} />{(t.versions ?? []).length}</dd>
              </dl>
              <div className="flex gap-2 mt-3">
                <button onClick={() => onOpen(t)} className="px-3 py-1.5 rounded-md bg-ink text-white text-[13px]">Open</button>
                <a href={t.url} target="_blank" className="px-3 py-1.5 rounded-md border border-line text-[13px] flex items-center gap-1 hover:bg-paper">New tab <ExternalLink size={12} /></a>
                <button onClick={() => getSsh(t)} className="px-3 py-1.5 rounded-md border border-line text-[13px] flex items-center gap-1 hover:bg-paper"><Terminal size={13} /> SSH</button>
              </div>
              {ssh[t.id] && <pre className="mt-2 text-[11.5px] bg-paper border border-line rounded p-2 overflow-x-auto font-mono">{ssh[t.id]}</pre>}
            </article>
          ))}
        </div>
        {!tools.length && <p className="text-graphite mt-6">No tools yet. Type /crm in the prompt bar to build the first one.</p>}
      </div>
    </div>
  );
}
