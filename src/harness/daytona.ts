// Daytona: one isolated sandbox per vibe-coded tool.
// Uses: Snapshots (declarative Image builder), labels, auto-stop/archive, domain allow-list firewall,
// Secrets (egress-proxy credential injection), FS API, process sessions + log streaming, git, preview URLs
// (signed, expiring), fork (versioning), SSH access (human tools), metrics.
import { Daytona, Image, type Sandbox } from "@daytona/sdk";
import path from "node:path";
import crypto from "node:crypto";
import { env, surrealHost, surrealHttpBase } from "@/lib/env";

let _d: Daytona | null = null;
export function daytona() {
  if (!_d) _d = new Daytona({ apiKey: env.daytonaKey, ...(process.env.DAYTONA_API_URL ? { apiUrl: process.env.DAYTONA_API_URL } : {}) });
  return _d;
}

const APP = "/home/daytona/app";
const TEMPLATE = "/opt/template";

export async function ensureSnapshot(onLog?: (s: string) => void) {
  const d = daytona();
  try { const s = await d.snapshot.get(env.snapshot); if (s) return s; } catch { /* create */ }
  const image = Image.base("node:22-slim")
    .runCommands("apt-get update && apt-get install -y --no-install-recommends git ca-certificates curl && rm -rf /var/lib/apt/lists/*")
    .runCommands("curl -sSf https://install.surrealdb.com | sh -s -- /usr/local/bin && surreal version || true")
    .addLocalDir(path.join(process.cwd(), "template"), TEMPLATE)
    .runCommands(`cd ${TEMPLATE} && npm i --no-audit --no-fund && npx vite build && chmod +x start.sh && chmod -R a+rwX ${TEMPLATE}`)
    .workdir("/home/daytona");
  return d.snapshot.create({ name: env.snapshot, image, resources: { cpu: 1, memory: 2, disk: 6 } }, { onLogs: onLog, timeout: 0 });
}

/** Allow-list: the only hosts a tool sandbox may reach. */
export function egressAllowList() {
  return [surrealHost(), "registry.npmjs.org"].filter(Boolean).join(",");
}

export async function ensureSecret(name: string, value: string, hosts: string[]) {
  const d = daytona();
  try {
    const list: any = await d.secret.list();
    const items: any[] = list.items ?? list.secrets ?? list.data ?? (Array.isArray(list) ? list : []);
    const found = items.find((s) => s.name === name);
    if (found) { await d.secret.update(found.id, { value, hosts } as any); return name; }
  } catch { /* create */ }
  await d.secret.create({ name, value, hosts, description: "VibeFlow per-tool SurrealDB token" });
  return name;
}

export async function createToolSandbox(opts: { slug: string; dbName: string; surrealToken?: string; runId: string }) {
  const d = daytona();
  const mode = process.env.VF_TOOL_DB ?? "embedded"; // "embedded" | "cloud"
  const envVars: Record<string, string> = { SURREAL_NS: env.surrealNs, SURREAL_DB: opts.dbName, PORT: "3000" };
  let secrets: Record<string, string> | undefined;
  let secretMode: string;
  if (mode === "cloud" && opts.surrealToken) {
    envVars.SURREAL_HTTP = surrealHttpBase();
    const secretName = `vf-${opts.slug}-surreal`;
    try { await ensureSecret(secretName, opts.surrealToken, [surrealHost()]); secrets = { SURREAL_TOKEN: secretName }; secretMode = "Daytona Secret (proxy-injected)"; }
    catch { envVars.SURREAL_TOKEN = opts.surrealToken; secretMode = "env fallback"; }
  } else {
    // Embedded SurrealDB inside the sandbox: random root password that never leaves the sandbox.
    envVars.SURREAL_HTTP = "http://127.0.0.1:8000";
    envVars.SURREAL_USER = "root";
    envVars.SURREAL_PASS = crypto.randomBytes(18).toString("base64url");
    secretMode = "embedded SurrealDB, sandbox-local credential";
  }
  const base = {
    name: `vf-${opts.slug}-${Date.now().toString(36)}`,
    snapshot: env.snapshot,
    envVars,
    secrets,
    labels: { app: "vibeflow", org: env.org, tool: opts.slug, run: opts.runId },
    autoStopInterval: 60,
    autoArchiveInterval: 60 * 24,
    public: false,
  };
  // One live sandbox per tool: retire previous versions (their code is in git history + tool_version records).
  await retireToolSandboxes(opts.slug);
  let sandbox: Sandbox;
  let firewall: string;
  try {
    sandbox = await d.create({ ...base, ...(mode === "embedded" ? { networkBlockAll: true } : { domainAllowList: egressAllowList() }) } as any, { timeout: 180 });
    firewall = mode === "embedded" ? "all outbound blocked" : `allow-list: ${egressAllowList()}`;
  } catch (e) {
    // Tier 1/2 orgs can't override network policy per sandbox; the org-level restricted egress policy applies.
    firewall = "org restricted egress (essential services only)";
    sandbox = await d.create(base as any, { timeout: 180 });
  }
  return { sandbox, secretMode, firewall };
}

export async function retireToolSandboxes(slug: string) {
  try {
    for await (const s of daytona().list({ labels: { app: "vibeflow", tool: slug } } as any)) await s.delete().catch(() => {});
  } catch { /* best effort */ }
}

export async function getSandbox(id: string) { return daytona().get(id); }

export async function exec(sb: Sandbox, cmd: string, cwd = APP, timeout = 180) {
  const r = await sb.process.executeCommand(cmd, cwd, undefined, timeout);
  return { code: r.exitCode, out: r.result ?? "" };
}

export async function prepareWorkspace(sb: Sandbox) {
  await exec(sb, `mkdir -p ${APP} && cd ${APP} && cp -r ${TEMPLATE}/. ${APP}/ 2>/dev/null; rm -rf ${APP}/node_modules && ln -sfn ${TEMPLATE}/node_modules ${APP}/node_modules`, "/home/daytona");
  // Push the latest runtime files from the repo so runtime fixes don't need a snapshot rebuild.
  const { readFile } = await import("node:fs/promises");
  for (const f of ["server.mjs", "seed.mjs", "start.sh", "src/api.ts", "src/main.tsx"]) {
    await sb.fs.uploadFile(await readFile(path.join(process.cwd(), "template", f)), `${APP}/${f}`);
  }
  try { await sb.git.init(APP, false, "main"); } catch { await exec(sb, "git init -b main"); }
  await exec(sb, `printf "node_modules\\ndist\\n" > .gitignore`);
  await sb.git.add(APP, ["."]);
  await sb.git.commit(APP, "template: vibeflow tool runtime", "VibeFlow Harness", "harness@vibeflow.dev", true);
}

export async function writeFiles(sb: Sandbox, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    await sb.fs.uploadFile(Buffer.from(content), `${APP}/${rel}`);
  }
}

export async function startDb(sb: Sandbox) {
  const session = "vf-db";
  try { await sb.process.deleteSession(session); } catch { /* none */ }
  await sb.process.createSession(session);
  await sb.process.executeSessionCommand(session, { command: `mkdir -p /home/daytona/data && surreal start --log warn --user root --pass "$SURREAL_PASS" --bind 127.0.0.1:8000 rocksdb:/home/daytona/data/tool.db`, runAsync: true } as any);
  for (let i = 0; i < 30; i++) {
    const h = await exec(sb, `node -e "fetch('http://127.0.0.1:8000/health').then(r=>console.log(r.status))"`, APP, 10);
    if (h.out.includes("200")) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("embedded SurrealDB did not start");
}

export async function seedDb(sb: Sandbox, seed: Record<string, unknown[]>, tables: string[] = []) {
  await sb.fs.uploadFile(Buffer.from(JSON.stringify({ tables, rows: seed })), `${APP}/seed.json`);
  return exec(sb, "node seed.mjs 2>&1", APP, 60);
}

export async function build(sb: Sandbox) { return exec(sb, "npx vite build 2>&1 | tail -40", APP, 240); }

export async function commit(sb: Sandbox, message: string) {
  await sb.git.add(APP, ["."]);
  const r = await sb.git.commit(APP, message, "VibeFlow Harness", "harness@vibeflow.dev", true);
  return (r as any).sha ?? (r as any).hash ?? "";
}

export async function startServer(sb: Sandbox, onLog?: (s: string) => void) {
  const session = "vf-server";
  try { await sb.process.deleteSession(session); } catch { /* none */ }
  await sb.process.createSession(session);
  const r = await sb.process.executeSessionCommand(session, { command: `cd ${APP} && sh start.sh`, runAsync: true } as any);
  const cmdId = (r as any).cmdId ?? (r as any).commandId;
  if (onLog && cmdId) {
    sb.process.getSessionCommandLogs(session, cmdId, (c) => onLog(c), (c) => onLog(c)).catch(() => {});
  }
  // wait for health
  for (let i = 0; i < 20; i++) {
    const h = await exec(sb, "curl -s localhost:3000/api/health || node -e \"fetch('http://localhost:3000/api/health').then(r=>r.text()).then(console.log)\"", APP, 10);
    if (h.out.includes("ok")) break;
    await new Promise((r) => setTimeout(r, 700));
  }
}

export async function previewUrls(sb: Sandbox) {
  const link = await sb.getPreviewLink(3000);
  let signed: string | null = null;
  try { const s: any = await sb.getSignedPreviewUrl(3000, 60 * 60 * 6); signed = s.url ?? null; } catch { /* older orgs */ }
  return { url: link.url, token: (link as any).token as string | undefined, signed };
}

export async function sshAccess(sb: Sandbox) {
  const s: any = await sb.createSshAccess(60);
  return s.sshCommand ?? `ssh ${s.token}@ssh.app.daytona.io`;
}

export async function listToolSandboxes() {
  const out: any[] = [];
  for await (const s of daytona().list({ labels: { app: "vibeflow" } } as any) as AsyncIterable<any>) out.push({ id: s.id, name: s.name, state: s.state, labels: s.labels, cpu: s.cpu, memory: s.memory, createdAt: s.createdAt });
  return out;
}

export async function auditLogs(limit = 30) {
  try {
    const r = await fetch(`https://app.daytona.io/api/audit?limit=${limit}`, { headers: { Authorization: `Bearer ${env.daytonaKey}` } });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}
