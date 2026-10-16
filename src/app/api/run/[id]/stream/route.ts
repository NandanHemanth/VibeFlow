// SSE stream of a run. Primary source: SurrealDB LIVE SELECT on run_event; fallback: in-process bus.
import { bus } from "@/harness/bus";
import { liveTable, sqlOne } from "@/harness/surreal";



export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const enc = new TextEncoder();
  let cleanup: (() => void)[] = [];
  const stream = new ReadableStream({
    async start(controller) {
      const seen = new Set<string>();
      const send = (e: any, via: string) => {
        const key = `${e.step}|${e.status}|${e.title}|${e.detail ?? ""}`;
        if (seen.has(key)) return; seen.add(key);
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify({ ...e, via })}\n\n`)); } catch { /* closed */ }
      };
      // replay what already happened
      try { const past = await sqlOne<any[]>(`SELECT * FROM run_event WHERE run = $r ORDER BY at`, { r: id }); (past ?? []).forEach((e) => send(e, "replay")); } catch { /* */ }
      const onBus = (e: any) => { if (e.run === id) setTimeout(() => send(e, "bus"), 400); };
      bus.on("event", onBus); cleanup.push(() => bus.off("event", onBus));
      try { const stop = await liveTable("run_event", (action, v: any) => { if (action === "CREATE" && v.run === id) send(v, "surreal-live"); }); cleanup.push(stop); } catch { /* live optional */ }
      const ka = setInterval(() => { try { controller.enqueue(enc.encode(`: ka\n\n`)); } catch { /* */ } }, 15000);
      cleanup.push(() => clearInterval(ka));
      req.signal.addEventListener("abort", () => { cleanup.forEach((f) => f()); try { controller.close(); } catch { /* */ } });
    },
    cancel() { cleanup.forEach((f) => f()); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
