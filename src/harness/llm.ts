// Model router: picks provider+model per task role, falls through a chain on failure.
// Primary: NVIDIA NIM (free). Secondary: Gemini (OpenAI-compatible). Fallback: OpenRouter free models.
import OpenAI from "openai";
import { env } from "@/lib/env";

export type Role = "plan" | "code" | "fast" | "judge";

type Route = { provider: "nim" | "gemini" | "openrouter"; model: string };

const ROUTES: Record<Role, Route[]> = {
  // NVIDIA NIM is primary, OpenRouter free models are fallback.
  // Measured 2026-10-16 on this key with reasoning trimmed: gpt-oss-20b (effort low) ~110 tok/s, nemotron-3-super (thinking off) ~45 tok/s.
  plan: [
    { provider: "nim", model: process.env.VF_PLAN_MODEL ?? "openai/gpt-oss-20b" },
    { provider: "nim", model: "nvidia/nemotron-3-super-120b-a12b" },
    { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
  ],
  code: [
    { provider: "nim", model: process.env.VF_CODE_MODEL ?? "openai/gpt-oss-20b" },
    { provider: "nim", model: "nvidia/nemotron-3-super-120b-a12b" },
    { provider: "openrouter", model: "cohere/north-mini-code:free" },
    { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
  ],
  fast: [
    { provider: "nim", model: process.env.VF_FAST_MODEL ?? "openai/gpt-oss-20b" },
    { provider: "openrouter", model: "nvidia/nemotron-3.5-lightning:free" },
  ],
  judge: [
    { provider: "nim", model: "openai/gpt-oss-20b" },
    { provider: "openrouter", model: "nvidia/nemotron-3-super-120b-a12b:free" },
  ],
};

const clients: Partial<Record<Route["provider"], OpenAI>> = {};
function client(p: Route["provider"]): OpenAI | null {
  if (clients[p]) return clients[p]!;
  const cfg = {
    nim: { key: env.nvidiaKey, baseURL: "https://integrate.api.nvidia.com/v1" },
    gemini: { key: env.geminiKey, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" },
    openrouter: { key: env.openrouterKey, baseURL: "https://openrouter.ai/api/v1" },
  }[p];
  if (!cfg.key) return null;
  clients[p] = new OpenAI({ apiKey: cfg.key, baseURL: cfg.baseURL, timeout: 180_000, maxRetries: 0 });
  return clients[p]!;
}

// Reasoning models spend minutes "thinking" before writing; trim it for interactive builds.
function modelExtras(model: string): Record<string, unknown> {
  if (model.startsWith("openai/gpt-oss")) return { reasoning_effort: "low" };
  if (model.includes("nemotron") || model.includes("glm")) return { chat_template_kwargs: { enable_thinking: false, thinking: false } };
  return {};
}

export type LlmResult = { text: string; provider: string; model: string; ms: number };

export async function complete(
  role: Role,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number; onProgress?: (chars: number, model: string) => void } = {},
): Promise<LlmResult> {
  const errors: string[] = [];
  for (const r of ROUTES[role]) {
    const c = client(r.provider);
    if (!c) continue;
    const t0 = Date.now();
    try {
      const stream = await c.chat.completions.create({
        model: r.model,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 8000,
        stream: true,
        ...modelExtras(r.model),
        ...(opts.json && r.provider !== "nim" ? { response_format: { type: "json_object" as const } } : {}),
      }, { timeout: 420_000 });
      let text = "", last = 0;
      for await (const chunk of stream) {
        text += chunk.choices[0]?.delta?.content ?? "";
        if (opts.onProgress && Date.now() - last > 2500) { last = Date.now(); opts.onProgress(text.length, `${r.provider}/${r.model}`); }
      }
      if (!text.trim()) throw new Error("empty completion");
      return { text, provider: r.provider, model: r.model, ms: Date.now() - t0 };
    } catch (e) {
      errors.push(`${r.provider}/${r.model}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  throw new Error(`All routes failed for role=${role}: ${errors.join(" | ")}`);
}

export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[\[{]/);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

export function extractCode(text: string, lang = "tsx"): string {
  const re = new RegExp("```(?:" + lang + "|typescript|ts|jsx|javascript)?\\s*([\\s\\S]*?)```", "i");
  const m = text.match(re);
  return (m ? m[1] : text).trim();
}

// Embeddings: NIM nemotron-3-embed-1b (2048d), fallback Gemini (truncated to 2048d)
export const EMBED_DIM = 2048;
export async function embed(text: string, kind: "query" | "passage" = "query"): Promise<number[] | null> {
  try {
    if (env.nvidiaKey) {
      const r = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.nvidiaKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "nvidia/nemotron-3-embed-1b", input: [text.slice(0, 2000)], input_type: kind, encoding_format: "float", truncate: "END" }),
      });
      if (r.ok) { const j = await r.json(); return j.data[0].embedding; }
    }
    if (env.geminiKey) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${env.geminiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text: text.slice(0, 2000) }] }, outputDimensionality: 3072 }),
      });
      if (r.ok) { const j = await r.json(); return (j.embedding.values as number[]).slice(0, EMBED_DIM); }
    }
  } catch { /* fall through */ }
  return null;
}
