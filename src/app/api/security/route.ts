import { listToolSandboxes, auditLogs, daytona, egressAllowList } from "@/harness/daytona";
 
export async function GET() {
  const out: any = { allowList: egressAllowList() };
  out.sandboxes = await listToolSandboxes().catch((e) => ({ error: e.message }));
  out.audit = await auditLogs().catch(() => null);
  out.secrets = await daytona().secret.list().then((l: any) => (l.items ?? l.secrets ?? l.data ?? l ?? []).map((s: any) => ({ name: s.name, hosts: s.hosts, updatedAt: s.updatedAt }))).catch((e: any) => ({ error: e.message }));
  return Response.json(out);
}
