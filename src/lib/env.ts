// Central env access. Server-only.
export const env = {
  daytonaKey: process.env.DAYTONA_API_KEY ?? "",
  surrealUrl: (process.env.SURREAL_URL ?? "").replace(/\/$/, ""),
  surrealUser: process.env.SURREAL_USER ?? "root",
  surrealPass: process.env.SURREAL_PASS ?? "root",
  surrealNs: process.env.SURREAL_NS ?? "vibeflow",
  surrealDb: process.env.SURREAL_DB ?? "harness",
  memUrl: (process.env.SPECTRON_URL ?? "").replace(/\/$/, ""),
  memCtx: process.env.SPECTRON_CONTEXT_ID ?? "",
  memKey: process.env.SPECTRON_API_KEY ?? "",
  nvidiaKey: process.env.NVIDIA_API_KEY ?? "",
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  openrouterKey: process.env.OPENROUTER_API_KEY ?? "",
  anchorKey: process.env.ANCHORBROWSER_API_KEY ?? "",
  org: process.env.VF_ORG ?? "acme",
  snapshot: process.env.VF_SNAPSHOT ?? "vibeflow-tool-runtime-v3",
  useSecrets: (process.env.VF_USE_DAYTONA_SECRETS ?? "true") === "true",
};

export function surrealHttpBase() {
  // accept wss://host/rpc, https://host, ws://host
  return env.surrealUrl
    .replace(/^wss:/, "https:")
    .replace(/^ws:/, "http:")
    .replace(/\/rpc$/, "");
}
export function surrealHost() {
  try { return new URL(surrealHttpBase()).hostname; } catch { return ""; }
}
