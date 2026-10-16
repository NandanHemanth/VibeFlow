import { ensureSnapshot } from "@/harness/daytona";
 export const maxDuration = 900;
export async function POST() {
  const logs: string[] = [];
  try { const s: any = await ensureSnapshot((l) => logs.push(l)); return Response.json({ ok: true, snapshot: s?.name, state: s?.state, logs: logs.slice(-20) }); }
  catch (e) { return Response.json({ ok: false, error: (e as Error).message, logs: logs.slice(-40) }, { status: 500 }); }
}
