// Run event bus. Every event is persisted to SurrealDB `run_event` (UI streams it via LIVE SELECT)
// and mirrored in-process as a fallback.
import { EventEmitter } from "node:events";
import { sql } from "./surreal";

const g = globalThis as any;
export const bus: EventEmitter = g.__vfBus ?? (g.__vfBus = new EventEmitter().setMaxListeners(100));

export type RunEvent = {
  run: string; step: string; status: "start" | "ok" | "warn" | "error" | "log" | "done";
  agent?: string; title: string; detail?: string; data?: Record<string, unknown>; ms?: number;
};

export async function emit(ev: RunEvent) {
  const e = { ...ev, at: new Date().toISOString() };
  bus.emit("event", e);
  try { await sql(`CREATE run_event CONTENT $e`, { e: { ...ev, data: ev.data ?? {} } }); } catch { /* db optional */ }
}
