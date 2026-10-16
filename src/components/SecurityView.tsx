"use client";
import { useEffect, useState } from "react";
import { Box, KeyRound, Network, ScrollText, Timer, Lock } from "lucide-react";

const CONTROLS = [
  { icon: Box, title: "Isolation per tool", body: "Each vibe-coded tool runs in its own Daytona sandbox with its own kernel, filesystem and network stack. A broken or malicious tool can't touch another." },
  { icon: Network, title: "No outbound network", body: "Tool sandboxes are created with all outbound traffic blocked. Generated code can't exfiltrate data or call anything on the internet." },
  { icon: KeyRound, title: "Credentials stay inside the sandbox", body: "Each tool's SurrealDB runs inside its own sandbox with a random password that never leaves it. In cloud mode the token is a Daytona Secret: code only sees a placeholder, swapped in at the egress proxy for one host." },
  { icon: Lock, title: "Signed, expiring previews", body: "Tools are shared through signed preview URLs that expire after six hours. SSH access for engineers is minted per request and expires in an hour." },
  { icon: Timer, title: "Ephemeral by default", body: "Idle sandboxes auto-stop after an hour and archive after a day. Labels tie every sandbox to its org, tool and run." },
  { icon: ScrollText, title: "Audit logs", body: "Every sandbox, secret and preview action is recorded in Daytona's audit log, with secret values masked." },
];

export default function SecurityView() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { fetch("/api/security").then((r) => r.json()).then(setD).catch(() => {}); }, []);
  const sandboxes: any[] = Array.isArray(d?.sandboxes) ? d.sandboxes : [];
  const secrets: any[] = Array.isArray(d?.secrets) ? d.secrets : [];
  const audit: any[] = Array.isArray(d?.audit) ? d.audit : d?.audit?.items ?? [];
  return (
    <div className="h-full overflow-y-auto dotgrid">
      <div className="max-w-[1180px] mx-auto px-8 py-8">
        <h1 className="text-[26px] font-semibold tracking-tight">Security</h1>
        <p className="text-graphite max-w-[70ch] mt-1">Every layer of protection comes from Daytona. Generated code is treated as untrusted from the first line.</p>
        <div className="grid grid-cols-3 gap-4 mt-6">
          {CONTROLS.map((c) => (
            <div key={c.title} className="bg-white border border-line rounded-xl p-4">
              <c.icon size={18} className="text-ink" />
              <div className="font-semibold mt-2">{c.title}</div>
              <p className="text-[13px] text-graphite mt-1">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <section className="bg-white border border-line rounded-xl p-4">
            <h2 className="font-semibold">Running sandboxes</h2>
            <table className="w-full mt-2 text-[12.5px]"><thead className="text-graphite text-left"><tr><th className="py-1 font-medium">Tool</th><th className="font-medium">State</th><th className="font-medium">Sandbox</th></tr></thead>
              <tbody>{sandboxes.map((s) => <tr key={s.id} className="border-t border-line"><td className="py-1.5">/{s.labels?.tool}</td><td>{s.state}</td><td className="font-mono text-graphite">{s.id.slice(0, 12)}</td></tr>)}</tbody></table>
            {!sandboxes.length && <p className="text-[12.5px] text-graphite mt-2">{d?.sandboxes?.error ?? "No tool sandboxes yet."}</p>}
          </section>
          <section className="bg-white border border-line rounded-xl p-4">
            <h2 className="font-semibold">Network and secrets</h2>
            <div className="text-[12.5px] mt-2"><span className="text-graphite">Tool sandboxes: </span>all outbound traffic blocked (networkBlockAll)</div>
            <div className="text-[12.5px] mt-1"><span className="text-graphite">Cloud-mode allow-list: </span><span className="font-mono break-all">{d?.allowList || "loading"}</span></div>
            <ul className="mt-2 text-[12.5px] space-y-1">{secrets.map((s) => <li key={s.name} className="flex justify-between border-t border-line pt-1"><span className="font-mono">{s.name}</span><span className="text-graphite">{(s.hosts ?? []).join(", ") || "unrestricted"}</span></li>)}</ul>
            {!secrets.length && <p className="text-[12.5px] text-graphite mt-2">No Daytona Secrets in use: tools run in embedded mode, so no credential ever crosses the network.</p>}
          </section>
        </div>
        <section className="bg-white border border-line rounded-xl p-4 mt-4">
          <h2 className="font-semibold">Audit log</h2>
          <ul className="mt-2 text-[12.5px] space-y-1 max-h-[260px] overflow-y-auto">{audit.slice(0, 40).map((a: any, i: number) => (
            <li key={i} className="grid grid-cols-[150px_180px_1fr] gap-3 border-t border-line pt-1"><span className="text-graphite">{new Date(a.createdAt ?? a.timestamp).toLocaleString()}</span><span className="font-medium">{a.action}</span><span className="text-graphite truncate">{a.targetType} {a.targetId}</span></li>))}</ul>
          {!audit.length && <p className="text-[12.5px] text-graphite mt-2">Audit entries appear here once the API key can read them, or open them in the Daytona dashboard.</p>}
        </section>
      </div>
    </div>
  );
}
